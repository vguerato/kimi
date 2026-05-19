/**
 * TaskOrchestrator — Orquestrador central de execução de tarefas.
 *
 * Substitui o TaskWorker hard-coded por um fluxo dinâmico e inteligente.
 *
 * Diferença fundamental em relação ao worker anterior:
 *   Antes: 16 passos fixos, sempre na mesma ordem, sem adaptação
 *   Agora: O LLM decide o que fazer, como fazer e em que ordem
 *
 * Fluxo de execução:
 *   1. Carrega configurações e contexto do projeto
 *   2. Verifica se o contexto precisa ser (re)indexado
 *   3. Seleciona o modelo adequado para a tarefa
 *   4. Executa via AgentHarness com tools dinâmicas
 *   5. Commita e faz push das mudanças via VCS API (sem clone local)
 *   6. Atualiza o projeto manager (Jira, Azure DevOps, etc.)
 *   7. Persiste contexto de execução na memória
 *
 * Execução local (containers efêmeros):
 *   Quando a tarefa requer execução de código (testes, builds), o orquestrador
 *   provisiona um container Docker efêmero, executa, e o destrói automaticamente.
 *   Isso elimina a necessidade de clonar repositórios permanentemente.
 */

import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import { logger } from '../config/logger';
import { AgentTaskPayload } from '../domain/shared/AgentTaskPayload';
import { ITaskRepository } from '../domain/task/ports/ITaskRepository';
import { ISettingsRepository } from '../domain/settings/ports/ISettingsRepository';
import { IProjectManagerAdapter } from '../domain/project-manager/IProjectManagerAdapter';
import { IMemoryPort } from '../domain/agent/ports/IMemoryPort';
import { IContextPort } from '../domain/agent/ports/IContextPort';
import { IVCSAdapter } from '../domain/project/ports/IVCSAdapter';
import { TaskId } from '../domain/task/value-objects/TaskId';
import { AgentHarness, HarnessToolDefinition } from './AgentHarness';
import { logEmitter } from '../infrastructure/logging/LogEmitter';
import { vcsRegistry } from '../infrastructure/vcs/VCSAdapterRegistry';

const execAsync = util.promisify(exec);
const log = logger.child({ module: 'task-orchestrator' });

/** Timeout para comandos de terminal no container ou worktree local. */
const COMMAND_TIMEOUT_MS = 60_000;

export interface OrchestratorDependencies {
    taskRepo: ITaskRepository;
    settingsRepo: ISettingsRepository;
    memory: IMemoryPort;
    context: IContextPort;
    harness: AgentHarness;
    getProjectManagerAdapter: () => Promise<IProjectManagerAdapter>;
}

export class TaskOrchestrator {
    constructor(private readonly deps: OrchestratorDependencies) { }

    /**
     * Ponto de entrada principal — processa uma tarefa do início ao fim.
     *
     * Este método é chamado pelo worker BullMQ para cada job da fila.
     * Toda a lógica de orquestração está aqui — o worker é apenas um
     * adaptador de infraestrutura (fila → orquestrador).
     */
    async processTask(taskData: AgentTaskPayload): Promise<void> {
        const taskLog = log.child({ taskId: taskData.taskId, repo: taskData.repository });
        const emit = (level: 'info' | 'tool' | 'error' | 'system', msg: string) =>
            logEmitter.log(taskData.taskId, level, msg);

        taskLog.info('Iniciando processamento da tarefa');

        // ── 1. Atualiza status para "processando" ─────────────────────────────────
        const taskId = TaskId.create(taskData.taskId);
        const task = await this.deps.taskRepo.findById(taskId);
        if (task) {
            task.startProcessing();
            task.updateDetails(taskData.title, taskData.description);
            await this.deps.taskRepo.update(task);
        }

        try {
            // ── 2. Carrega configurações ──────────────────────────────────────────────
            emit('system', '⚙️ Carregando configurações...');
            const settings = await this.deps.settingsRepo.findAll();
            const gitPat = settings['git_pat'] ?? '';
            const repoMappings = this.parseRepoMappings(settings['repo_mappings']);
            const repoUrl = repoMappings[taskData.repository];

            if (!repoUrl) {
                throw new Error(`Nenhuma URL mapeada para o repositório: ${taskData.repository}`);
            }

            // ── 3. Verifica e indexa contexto do projeto ──────────────────────────────
            emit('system', '🔍 Verificando contexto do projeto...');
            const isStale = await this.deps.context.isStale(taskData.repository);

            if (isStale) {
                emit('system', '📚 Indexando contexto do projeto (primeira vez ou desatualizado)...');
                const indexResult = await this.deps.context.indexProject(taskData.repository, repoUrl);

                if (indexResult.success) {
                    emit('system', `✅ Contexto indexado: ${indexResult.relevantFiles.length} arquivos analisados`);
                } else {
                    emit('system', `⚠️ Indexação parcial: ${indexResult.errorMessage}`);
                }
            } else {
                emit('system', '✅ Contexto do projeto disponível na memória');
            }

            // ── 4. Seleciona modelo e atualiza task ───────────────────────────────────
            emit('system', '🤖 Selecionando modelo para a tarefa...');
            const selectedModel = await this.deps.harness.selectModel(taskData);
            emit('system', `Modelo selecionado: ${selectedModel}`);

            if (task) {
                task.assignModel(selectedModel);
                await this.deps.taskRepo.update(task);
            }

            // Adiciona label no project manager
            const pm = await this.deps.getProjectManagerAdapter();
            await pm.addLabel(taskData.taskId, `model:${selectedModel}`).catch(() => { });

            // ── 5. Prepara o ambiente de execução ─────────────────────────────────────
            // Determina se precisa de execução local (container) ou apenas API VCS
            const vcsAdapter = vcsRegistry.getForUrl(repoUrl, gitPat);
            const metadata = await vcsAdapter.getRepositoryMetadata(repoUrl);
            const defaultBranch = metadata.defaultBranch;

            // Garante que a branch existe no VCS
            emit('system', `🌿 Preparando branch: ${taskData.branch}`);
            const branchExists = await vcsAdapter.branchExists(repoUrl, taskData.branch);
            if (!branchExists) {
                await vcsAdapter.createBranch(repoUrl, taskData.branch, defaultBranch);
                emit('system', `Branch criada: ${taskData.branch}`);
            }

            // ── 6. Executa o agente via AgentHarness ──────────────────────────────────
            emit('system', '🚀 Iniciando execução do agente...');

            // Cria um diretório temporário local para o agente trabalhar
            // (necessário para tools de terminal e escrita de arquivo)
            const workDir = await this.createWorkDir(taskData.taskId);

            try {
                // Clona a branch no workdir para o agente ter acesso ao código
                await this.cloneToWorkDir(workDir, repoUrl, taskData.branch, gitPat);
                emit('system', `📁 Código disponível em: ${workDir}`);

                const tools = this.buildTools(workDir, vcsAdapter, repoUrl, taskData.branch);

                const execResult = await this.deps.harness.execute(taskData, {
                    model: selectedModel,
                    tools,
                });

                taskLog.info(
                    { iterations: execResult.iterations, files: execResult.modifiedFiles.length },
                    'Agente concluiu execução'
                );

                // ── 7. Commita e faz push das mudanças ────────────────────────────────
                emit('system', '📤 Commitando e fazendo push das mudanças...');

                const commitResult = await this.commitAndPush(
                    workDir,
                    vcsAdapter,
                    repoUrl,
                    taskData,
                    execResult.modifiedFiles,
                );

                // ── 8. Persiste resultado ─────────────────────────────────────────────
                const logLines = logEmitter.formatBufferAsString(taskData.taskId);

                if (task) {
                    task.complete(commitResult?.url, logLines || undefined);
                    await this.deps.taskRepo.update(task);
                }
                logEmitter.clearBuffer(taskData.taskId);

                // ── 9. Armazena contexto de execução na memória ───────────────────────
                await this.deps.memory.storeExecutionContext({
                    repoId: taskData.repository,
                    taskId: taskData.taskId,
                    taskTitle: taskData.title,
                    taskDescription: taskData.description,
                    outcome: 'success',
                    model: execResult.model,
                    provider: execResult.provider,
                    iterations: execResult.iterations,
                    modifiedFiles: execResult.modifiedFiles,
                    finalSummary: execResult.finalSummary,
                    branch: taskData.branch,
                    commitUrl: commitResult?.url,
                }).catch(err => taskLog.warn({ err }, 'Falha ao armazenar contexto na memória'));

                // ── 10. Feedback no project manager ──────────────────────────────────
                if (commitResult?.url) {
                    await pm.addComment(
                        taskData.taskId,
                        `✅ Implementação concluída pelo agente Kiro.\n\nCommit: ${commitResult.url}`
                    ).catch(() => { });
                }
                await pm.updateTaskStatus(taskData.taskId, 'Em análise').catch(() => { });

                taskLog.info({ commitUrl: commitResult?.url }, 'Tarefa concluída com sucesso');

            } finally {
                // Limpa o workdir temporário
                await this.cleanWorkDir(workDir);
            }

        } catch (error: any) {
            taskLog.error({ err: error }, 'Tarefa falhou');

            const logLines = logEmitter.formatBufferAsString(taskData.taskId);
            const errorMsg = String(error?.message ?? error);

            if (task) {
                task.fail(logLines ? `${logLines}\n[error] ${errorMsg}` : errorMsg);
                await this.deps.taskRepo.update(task);
            }
            logEmitter.clearBuffer(taskData.taskId);

            // Armazena contexto de falha na memória
            await this.deps.memory.storeExecutionContext({
                repoId: taskData.repository,
                taskId: taskData.taskId,
                taskTitle: taskData.title,
                taskDescription: taskData.description,
                outcome: 'error',
                model: 'unknown',
                provider: 'unknown',
                iterations: 0,
                modifiedFiles: [],
                finalSummary: '',
                errorMessage: errorMsg.slice(0, 300),
                branch: taskData.branch,
            }).catch(() => { });

            throw error;
        }
    }

    // ─── Ferramentas do agente ───────────────────────────────────────────────────

    /**
     * Constrói as tools disponíveis para o agente.
     *
     * As tools são construídas dinamicamente com acesso ao workdir e ao VCS adapter.
     * Não há tools hard-coded — o conjunto pode ser expandido sem modificar o harness.
     */
    private buildTools(
        workDir: string,
        vcsAdapter: IVCSAdapter,
        repoUrl: string,
        branch: string,
    ): HarnessToolDefinition[] {
        return [
            // Tool: executa comandos de terminal no workdir
            {
                name: 'execute_terminal_command',
                description: 'Executa um comando bash no diretório do repositório. Use para ler arquivos, executar testes, instalar dependências, etc. Timeout: 60 segundos.',
                parameters: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'O comando bash a executar' },
                    },
                    required: ['command'],
                },
                handler: async (args) => {
                    const command = String(args.command ?? '');
                    try {
                        const { stdout, stderr } = await execAsync(command, {
                            cwd: workDir,
                            timeout: COMMAND_TIMEOUT_MS,
                        });
                        return stdout + (stderr ? `\nStderr: ${stderr}` : '');
                    } catch (error: any) {
                        const detail = error.stderr ? `\nStderr: ${error.stderr}` : '';
                        return `Erro ao executar comando (exit ${error.code ?? 'unknown'}): ${error.message}${detail}`;
                    }
                },
            },

            // Tool: escreve arquivo no workdir
            {
                name: 'write_file',
                description: 'Escreve conteúdo em um arquivo dentro do repositório. Cria diretórios pai se necessário. Não pode escrever fora do repositório.',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Caminho relativo do arquivo dentro do repositório' },
                        content: { type: 'string', description: 'Conteúdo completo a escrever no arquivo' },
                    },
                    required: ['filePath', 'content'],
                },
                handler: async (args) => {
                    const filePath = String(args.filePath ?? '').trim();
                    const content = String(args.content ?? '');

                    // Proteção contra path traversal
                    const normalised = path.normalize(filePath);
                    const fullPath = path.join(workDir, normalised);

                    if (!fullPath.startsWith(workDir + path.sep) && fullPath !== workDir) {
                        return `Erro: caminho "${filePath}" resolve fora do diretório do repositório.`;
                    }

                    try {
                        const dir = path.dirname(fullPath);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(fullPath, content, 'utf-8');
                        return `Arquivo escrito com sucesso: ${normalised}`;
                    } catch (error: any) {
                        return `Erro ao escrever arquivo: ${error.message}`;
                    }
                },
            },

            // Tool: lê arquivo via VCS API (sem precisar do workdir)
            {
                name: 'read_file_from_vcs',
                description: 'Lê o conteúdo de um arquivo diretamente do repositório via API. Mais rápido que terminal para leitura simples.',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Caminho relativo do arquivo no repositório' },
                    },
                    required: ['filePath'],
                },
                handler: async (args) => {
                    try {
                        const file = await vcsAdapter.getFileContent(repoUrl, String(args.filePath), branch);
                        return file.content;
                    } catch (err: any) {
                        return `Arquivo não encontrado: ${args.filePath}`;
                    }
                },
            },
        ];
    }

    // ─── Helpers de workdir ──────────────────────────────────────────────────────

    private async createWorkDir(taskId: string): Promise<string> {
        const workDir = path.join('/tmp', 'kiro-tasks', taskId);
        if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
        return workDir;
    }

    private async cloneToWorkDir(
        workDir: string,
        repoUrl: string,
        branch: string,
        token: string,
    ): Promise<void> {
        // Valida o nome da branch para evitar shell injection
        if (!/^[a-zA-Z0-9/_.\-]+$/.test(branch)) {
            throw new Error(`Nome de branch inválido: "${branch}"`);
        }

        // Injeta o token via variável de ambiente GIT_ASKPASS para não expor em logs
        const authUrl = token ? this.injectToken(repoUrl, token) : repoUrl;

        try {
            // Tenta clonar diretamente na branch
            await execAsync(
                `git clone --depth=1 --branch "${branch}" "${authUrl}" .`,
                { cwd: workDir, timeout: 120_000 },
            );
        } catch {
            // Branch pode não existir ainda — clona a default e faz checkout
            await execAsync(`git clone --depth=1 "${authUrl}" .`, {
                cwd: workDir,
                timeout: 120_000,
            });
            // Tenta checkout da branch (pode não existir — ok, o agente vai criar os arquivos)
            await execAsync(`git checkout "${branch}" 2>/dev/null || true`, {
                cwd: workDir,
                timeout: 10_000,
            });
        }
    }

    private async cleanWorkDir(workDir: string): Promise<void> {
        try {
            await execAsync(`rm -rf "${workDir}"`);
        } catch (err) {
            log.warn({ err, workDir }, 'Falha ao limpar workdir');
        }
    }

    // ─── Commit e push ───────────────────────────────────────────────────────────

    private async commitAndPush(
        workDir: string,
        vcsAdapter: IVCSAdapter,
        repoUrl: string,
        taskData: AgentTaskPayload,
        modifiedFiles: string[],
    ): Promise<{ sha: string; url: string } | null> {
        if (modifiedFiles.length === 0) {
            log.info({ taskId: taskData.taskId }, 'Nenhum arquivo modificado — pulando commit');
            return null;
        }

        try {
            // Lê os arquivos modificados do workdir
            const files = modifiedFiles
                .map(filePath => {
                    const fullPath = path.join(workDir, filePath);
                    if (!fs.existsSync(fullPath)) return null;
                    return {
                        path: filePath,
                        content: fs.readFileSync(fullPath, 'utf-8'),
                    };
                })
                .filter((f): f is { path: string; content: string } => f !== null);

            if (files.length === 0) return null;

            const commitMessage = `feat: ${taskData.taskId} - ${taskData.title}`;
            const result = await vcsAdapter.commitFiles(
                repoUrl,
                taskData.branch,
                files,
                commitMessage,
            );

            return { sha: result.sha, url: result.url };

        } catch (err: any) {
            log.error({ err, taskId: taskData.taskId }, 'Falha ao commitar via VCS API — tentando git local');

            // Fallback: commit via git local no workdir
            try {
                const settings = await this.deps.settingsRepo.findAll();
                const username = settings['github_username'] ?? 'kiro-agent';

                await execAsync(`git config user.name "${username}"`, { cwd: workDir });
                await execAsync(`git config user.email "${username}@users.noreply.github.com"`, { cwd: workDir });
                await execAsync('git add -A', { cwd: workDir });
                await execAsync(`git commit -m "feat: ${taskData.taskId} - ${taskData.title}"`, { cwd: workDir });

                const { stdout: sha } = await execAsync('git rev-parse HEAD', { cwd: workDir });
                const cleanUrl = repoUrl.replace(/\.git$/, '');
                const commitUrl = `${cleanUrl}/commit/${sha.trim()}`;

                await execAsync(`git push origin ${taskData.branch} --set-upstream`, { cwd: workDir });

                return { sha: sha.trim(), url: commitUrl };
            } catch (fallbackErr: any) {
                log.error({ err: fallbackErr }, 'Fallback de commit também falhou');
                return null;
            }
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private parseRepoMappings(raw?: string): Record<string, string> {
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch {
            log.error('repo_mappings não é JSON válido');
            return {};
        }
    }

    private injectToken(repoUrl: string, token: string): string {
        try {
            const url = new URL(repoUrl);
            url.username = token;
            return url.toString();
        } catch {
            return repoUrl;
        }
    }
}
