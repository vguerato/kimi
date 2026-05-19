/**
 * DockerContainerRuntime — Implementação de IContainerRuntime via Docker API.
 *
 * Usa a biblioteca `dockerode` para comunicação com o Docker daemon.
 *
 * ─── Compatibilidade com Docker Compose ──────────────────────────────────────
 *
 *   Em ambientes Docker Compose, o daemon é acessível via socket Unix montado
 *   no container. Configure no docker-compose.yml:
 *
 *     services:
 *       backend:
 *         volumes:
 *           - /var/run/docker.sock:/var/run/docker.sock
 *
 *   Para Docker remoto (ex: Docker in Docker, CI/CD), defina DOCKER_HOST:
 *     DOCKER_HOST=tcp://docker:2375
 *
 *   Os containers efêmeros criados por este runtime são automaticamente
 *   identificados com labels `shift.managed=true` para facilitar limpeza
 *   em caso de crash do servidor.
 *
 * ─── Nota sobre o @docker/sdk ────────────────────────────────────────────────
 *
 *   O SDK oficial (@docker/sdk) é uma API gRPC voltada para integração com o
 *   Docker Desktop (extensões, CLI plugins). Não expõe APIs para criar/gerenciar
 *   containers programaticamente como o dockerode faz. Para este caso de uso
 *   (provisionar containers efêmeros), dockerode é a escolha correta.
 *   Ref: https://github.com/apocas/dockerode
 *
 * ─── Fluxo de um container efêmero ───────────────────────────────────────────
 *
 *   1. Pull da imagem (se não disponível localmente)
 *   2. Criação do container com o repositório clonado em /workspace
 *   3. Execução dos comandos solicitados
 *   4. Coleta de stdout/stderr
 *   5. Destruição automática do container
 *
 * ─── Segurança ────────────────────────────────────────────────────────────────
 *
 *   - Containers rodam sem privilégios (--no-new-privileges)
 *   - Rede isolada (NetworkMode: 'none') — sem acesso à rede do host
 *   - Limites de CPU e memória configuráveis via ContainerSpec
 *   - TTL automático via timeout (padrão: 5 minutos)
 *
 * ─── Quando usar containers vs API-first ─────────────────────────────────────
 *
 *   - API-first: leitura de arquivos, commits, PRs, branches (sem container)
 *   - Container: execução de testes, builds, lint, scripts de deploy
 */

import { injectable } from 'tsyringe';
import Dockerode from 'dockerode';
import { PassThrough } from 'stream';
import { logger } from '../../config/logger';
import {
  IContainerRuntime,
  ContainerSpec,
  ContainerExecResult,
  ContainerHandle,
} from '../../domain/agent/ports/IContainerRuntime';

const log = logger.child({ module: 'docker-runtime' });

/** Timeout padrão: 5 minutos. */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Memória padrão: 512MB. */
const DEFAULT_MEMORY_BYTES = 512 * 1024 * 1024;

// ─── ContainerHandle ─────────────────────────────────────────────────────────

class DockerContainerHandle implements ContainerHandle {
  constructor(
    readonly id: string,
    private readonly container: Dockerode.Container,
    private readonly docker: Dockerode,
  ) { }

  async exec(command: string): Promise<ContainerExecResult> {
    const startTime = Date.now();

    try {
      const exec = await this.container.exec({
        Cmd: ['sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();
        stdoutStream.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        stderrStream.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

        this.docker.modem.demuxStream(stream, stdoutStream, stderrStream);

        stream.on('end', async () => {
          const inspect = await exec.inspect();
          resolve({
            exitCode: inspect.ExitCode ?? 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            durationMs: Date.now() - startTime,
            timedOut: false,
          });
        });

        stream.on('error', (err: Error) => {
          resolve({
            exitCode: 1,
            stdout,
            stderr: stderr + '\n' + err.message,
            durationMs: Date.now() - startTime,
            timedOut: false,
          });
        });
      });
    } catch (err: any) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: String(err?.message ?? err),
        durationMs: Date.now() - startTime,
        timedOut: false,
      };
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const escaped = content.replace(/'/g, "'\\''");
    await this.exec(`mkdir -p "$(dirname '${filePath}')" && printf '%s' '${escaped}' > '${filePath}'`);
  }

  async readFile(filePath: string): Promise<string> {
    const result = await this.exec(`cat '${filePath}'`);
    if (result.exitCode !== 0) throw new Error(`Arquivo não encontrado: ${filePath}`);
    return result.stdout;
  }

  async destroy(): Promise<void> {
    try {
      await this.container.stop({ t: 5 });
    } catch { /* já parado */ }
    try {
      await this.container.remove({ force: true });
      log.debug({ containerId: this.id }, 'Container destruído');
    } catch (err) {
      log.warn({ err, containerId: this.id }, 'Falha ao remover container');
    }
  }
}

// ─── DockerContainerRuntime ───────────────────────────────────────────────────

@injectable()
export class DockerContainerRuntime implements IContainerRuntime {
  private readonly docker: Dockerode;

  constructor() {
    // Conecta ao Docker daemon via socket Unix (padrão) ou TCP
    this.docker = process.env.DOCKER_HOST
      ? new Dockerode({ host: process.env.DOCKER_HOST })
      : new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  async provision(
    repoUrl: string,
    branch: string,
    token: string,
    spec: ContainerSpec,
  ): Promise<ContainerHandle> {
    const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const memoryBytes = spec.memoryLimit ?? DEFAULT_MEMORY_BYTES;

    log.info({ image: spec.image, repoUrl, branch }, 'Provisionando container efêmero');

    // Injeta o token na URL para autenticação
    const authUrl = this.injectToken(repoUrl, token);

    // Script de inicialização: clona o repo e faz checkout da branch
    const initScript = [
      'set -e',
      `git clone --depth=1 --branch "${branch}" "${authUrl}" /workspace 2>/dev/null || \\`,
      `  git clone --depth=1 "${authUrl}" /workspace`,
      `cd /workspace`,
      `git checkout "${branch}" 2>/dev/null || true`,
    ].join('\n');

    // Cria e inicia o container
    const container = await this.docker.createContainer({
      Image: spec.image,
      Cmd: ['sh', '-c', `${initScript} && tail -f /dev/null`],
      WorkingDir: '/workspace',
      Env: Object.entries(spec.env ?? {}).map(([k, v]) => `${k}=${v}`),
      HostConfig: {
        Memory: memoryBytes,
        NanoCpus: Math.floor((spec.cpuLimit ?? 1) * 1e9),
        AutoRemove: false,
        NetworkMode: 'none', // sem acesso à rede por segurança
        SecurityOpt: ['no-new-privileges'],
        ReadonlyRootfs: false,
      },
      Labels: {
        'shift.managed': 'true',
        'shift.repo': repoUrl,
        'shift.branch': branch,
        'shift.created': new Date().toISOString(),
      },
    });

    await container.start();

    // Aguarda o clone completar
    const cloneResult = await new DockerContainerHandle(container.id, container, this.docker)
      .exec('test -d /workspace/.git && echo "ready"');

    if (!cloneResult.stdout.includes('ready')) {
      await container.remove({ force: true });
      throw new Error(`Falha ao clonar repositório no container: ${cloneResult.stderr}`);
    }

    log.info({ containerId: container.id, image: spec.image }, 'Container pronto');

    // Configura destruição automática por timeout
    setTimeout(async () => {
      try {
        await container.remove({ force: true });
        log.warn({ containerId: container.id }, 'Container destruído por timeout');
      } catch { /* já destruído */ }
    }, timeoutMs);

    return new DockerContainerHandle(container.id, container, this.docker);
  }

  async runEphemeral(
    repoUrl: string,
    branch: string,
    token: string,
    commands: string[],
    spec: ContainerSpec,
  ): Promise<ContainerExecResult[]> {
    const handle = await this.provision(repoUrl, branch, token, spec);

    try {
      const results: ContainerExecResult[] = [];
      for (const command of commands) {
        const result = await handle.exec(command);
        results.push(result);
        // Para na primeira falha
        if (result.exitCode !== 0) break;
      }
      return results;
    } finally {
      await handle.destroy();
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private injectToken(repoUrl: string, token: string): string {
    if (!token) return repoUrl;
    try {
      const url = new URL(repoUrl);
      url.username = token;
      return url.toString();
    } catch {
      return repoUrl;
    }
  }
}

/** Singleton — instanciado uma vez no bootstrap. */
export const containerRuntime = new DockerContainerRuntime();
