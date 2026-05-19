/**
 * IMemoryPort — Port para o sistema de memória do agente.
 *
 * Define o contrato para armazenamento e recuperação de memórias
 * em múltiplas camadas (episódica, semântica, procedural).
 *
 * Implementações concretas vivem em infrastructure/memory/.
 */

export interface MemoryEntry {
    id?: string;
    /** Conteúdo textual da memória. */
    content: string;
    /** Metadados estruturados para filtragem. */
    metadata: Record<string, unknown>;
    /** Score de relevância (0–1), presente apenas em resultados de busca. */
    score?: number;
    createdAt?: Date;
}

export interface MemorySearchOptions {
    /** Número máximo de resultados. Padrão: 5. */
    limit?: number;
    /** Score mínimo de relevância (0–1). Padrão: 0.5. */
    minScore?: number;
    /** Filtros de metadados para narrowing. */
    filters?: Record<string, unknown>;
}

export interface ExecutionMemory {
    repoId: string;
    taskId: string;
    taskTitle: string;
    taskDescription: string;
    outcome: 'success' | 'error';
    model: string;
    provider: string;
    iterations: number;
    modifiedFiles: string[];
    finalSummary: string;
    errorMessage?: string;
    branch: string;
    commitUrl?: string | null;
}

export interface ProjectContextMemory {
    repoId: string;
    /** Contexto sintetizado pelo LLM sobre o projeto. */
    synthesizedContext: string;
    /** Linguagem principal detectada. */
    language?: string;
    /** Framework principal detectado. */
    framework?: string;
    /** Comando de build detectado. */
    buildCommand?: string;
    /** Comando de testes detectado. */
    testCommand?: string;
    /** Comando de lint detectado. */
    lintCommand?: string;
    /** Convenções e diretrizes do projeto. */
    conventions: string[];
    /** Specs e documentações relevantes. */
    specs: string[];
    /** Confiança do contexto (0–1). */
    confidence: number;
    /** ISO timestamp de quando o contexto foi indexado. */
    indexedAt?: string;
}

export interface IMemoryPort {
    /** Inicializa a conexão com o backend de memória. */
    initialize(): Promise<void>;

    /**
     * Armazena o contexto de uma execução concluída.
     * Usado para aprendizado contínuo entre tarefas.
     */
    storeExecutionContext(memory: ExecutionMemory): Promise<void>;

    /**
     * Armazena o contexto sintetizado de um projeto.
     * Chamado após indexação bem-sucedida.
     */
    storeProjectContext(context: ProjectContextMemory): Promise<void>;

    /**
     * Busca memórias relevantes para uma tarefa específica.
     * Retorna texto formatado pronto para injeção no prompt.
     */
    searchRelevantMemories(
        repoId: string,
        query: string,
        options?: MemorySearchOptions,
    ): Promise<MemoryEntry[]>;

    /**
     * Retorna o contexto do projeto armazenado na memória.
     * Retorna null se não houver contexto indexado.
     */
    getProjectContext(repoId: string): Promise<ProjectContextMemory | null>;

    /**
     * Formata memórias relevantes como string para injeção no prompt.
     * Retorna string vazia se não houver memórias relevantes.
     */
    buildContextString(
        repoId: string,
        taskTitle: string,
        taskDescription: string,
    ): Promise<string>;

    /** Remove todas as memórias de um repositório específico. */
    clearProjectMemory(repoId: string): Promise<void>;
}
