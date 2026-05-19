/**
 * DTOs de Project — contratos de entrada e saída da API de projetos.
 */

/** Resumo de um projeto na listagem. */
export interface ProjectSummaryDto {
    prefix: string;
    url: string;
    hasContext: boolean;
    language?: string;
    framework?: string;
    confidence?: number;
}

/** Resposta do GET /repos/status. */
export type RepoStatusResponseDto = Record<string, 'ready' | 'pending'>;

/** Resposta do POST /projects/:prefix/index. */
export interface IndexProjectResponseDto {
    success: true;
    message: string;
}
