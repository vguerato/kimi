/**
 * IContainerRuntime — Port para execução em containers efêmeros.
 *
 * Abstrai o runtime de containers (Docker, Podman, etc.).
 * Containers são provisionados sob demanda, executam uma tarefa e são destruídos.
 *
 * Usado quando a tarefa requer execução local de código (testes, builds, etc.)
 * sem a necessidade de clonar o repositório permanentemente.
 */

export interface ContainerSpec {
    /**
     * Imagem Docker a usar.
     * Determinada pelo LLM ao analisar o projeto (ex: "node:20-alpine").
     */
    image: string;
    /** Variáveis de ambiente injetadas no container. */
    env?: Record<string, string>;
    /** Memória máxima em bytes. Padrão: 512MB. */
    memoryLimit?: number;
    /** CPUs disponíveis. Padrão: 1. */
    cpuLimit?: number;
    /** Timeout em ms antes de matar o container. Padrão: 300000 (5min). */
    timeoutMs?: number;
}

export interface ContainerExecResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    /** Tempo de execução em ms. */
    durationMs: number;
    /** true se o container foi morto por timeout. */
    timedOut: boolean;
}

export interface ContainerHandle {
    id: string;
    /** Executa um comando dentro do container já provisionado. */
    exec(command: string): Promise<ContainerExecResult>;
    /** Escreve um arquivo dentro do container. */
    writeFile(path: string, content: string): Promise<void>;
    /** Lê um arquivo do container. */
    readFile(path: string): Promise<string>;
    /** Destrói o container e libera recursos. */
    destroy(): Promise<void>;
}

export interface IContainerRuntime {
    /**
     * Provisiona um container efêmero com o repositório clonado.
     *
     * O container é criado com o código do repositório disponível em /workspace.
     * Após o uso, deve ser destruído via handle.destroy().
     */
    provision(
        repoUrl: string,
        branch: string,
        token: string,
        spec: ContainerSpec,
    ): Promise<ContainerHandle>;

    /**
     * Executa uma sequência de comandos em um container efêmero e retorna os resultados.
     * O container é destruído automaticamente após a execução.
     *
     * Conveniente para casos onde não é necessário manter o container entre comandos.
     */
    runEphemeral(
        repoUrl: string,
        branch: string,
        token: string,
        commands: string[],
        spec: ContainerSpec,
    ): Promise<ContainerExecResult[]>;

    /** Verifica se o runtime está disponível e operacional. */
    isAvailable(): Promise<boolean>;
}
