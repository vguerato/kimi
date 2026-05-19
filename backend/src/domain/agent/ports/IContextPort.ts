/**
 * IContextPort — Port para o motor de indexação e recuperação de contexto.
 *
 * Responsável por descobrir, indexar e recuperar o contexto de um projeto
 * de forma inteligente — sem buscas hard-coded por arquivos específicos.
 *
 * O LLM é usado para identificar quais arquivos contêm informações relevantes
 * (specs, diretrizes, configurações, documentação) e para sintetizar o contexto.
 */

import { ProjectContextMemory } from './IMemoryPort';

export interface IndexingResult {
    success: boolean;
    context?: ProjectContextMemory;
    /** Arquivos identificados como relevantes pelo LLM. */
    relevantFiles: string[];
    /** Número de chunks indexados na memória semântica. */
    chunksIndexed: number;
    errorMessage?: string;
    durationMs: number;
}

export interface ContextQuery {
    repoId: string;
    /** Pergunta ou tarefa para a qual o contexto é necessário. */
    query: string;
    /** Número máximo de chunks de contexto a retornar. Padrão: 5. */
    maxChunks?: number;
}

export interface ContextChunk {
    content: string;
    source: string;
    relevanceScore: number;
    category: 'spec' | 'guideline' | 'config' | 'documentation' | 'code' | 'other';
}

export interface IContextPort {
    /**
     * Indexa o contexto completo de um projeto.
     *
     * Fluxo:
     *   1. Lista estrutura de arquivos via VCS API
     *   2. Pede ao LLM para identificar arquivos relevantes
     *   3. Busca conteúdo dos arquivos identificados
     *   4. LLM sintetiza um ProjectContext estruturado
     *   5. Persiste na memória semântica
     *
     * Não faz clone local — usa apenas a VCS API.
     */
    indexProject(repoId: string, repoUrl: string): Promise<IndexingResult>;

    /**
     * Recupera chunks de contexto relevantes para uma query.
     * Usa busca semântica na memória indexada.
     */
    retrieveContext(query: ContextQuery): Promise<ContextChunk[]>;

    /**
     * Formata o contexto recuperado como string para injeção no prompt.
     * Inclui contexto do projeto + memórias de execuções anteriores.
     */
    buildPromptContext(
        repoId: string,
        taskTitle: string,
        taskDescription: string,
    ): Promise<string>;

    /**
     * Verifica se o contexto de um projeto está atualizado.
     * Retorna true se precisar de re-indexação.
     */
    isStale(repoId: string): Promise<boolean>;
}
