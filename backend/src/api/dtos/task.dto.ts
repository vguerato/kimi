/**
 * DTOs de Task — contratos de entrada e saída da API HTTP.
 *
 * Separam a representação HTTP do aggregate de domínio.
 * O controller converte TaskAggregate → TaskResponseDto antes de enviar.
 */

/** Representação de uma tarefa na resposta da API (snake_case para compatibilidade com o frontend). */
export interface TaskResponseDto {
    id: string;
    parent_id: string;
    title: string | null;
    description: string | null;
    repository: string;
    branch: string;
    status: string;
    model: string | null;
    commit_url: string | null;
    logs: string | null;
    created_at: Date;
    updated_at: Date;
}

/** Corpo da requisição de retry (sem campos obrigatórios — o ID vem da URL). */
export interface RetryTaskRequestDto {
    // Sem campos — o taskId vem de req.params.id
}

/** Resposta de operações de sucesso simples. */
export interface SuccessResponseDto {
    success: true;
    id?: string;
    message?: string;
}

/** Resposta de erro. */
export interface ErrorResponseDto {
    success?: false;
    error: string;
    state?: string;
}
