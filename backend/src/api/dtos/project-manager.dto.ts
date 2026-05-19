/**
 * DTOs de Project Manager — contratos de entrada e saída da API de PM.
 */

/** Corpo da requisição POST /project-manager/mapping e POST /jira/mapping. */
export interface SaveMappingRequestDto {
    triggerStatuses: string[];
    skipStatuses: string[];
    delegatableTypes: string[];
    parentTypes: string[];
}

/** Corpo da requisição POST /jira/setup-webhook. */
export interface SetupWebhookRequestDto {
    /** URL explícita do webhook. Se omitida, usa a URL do Ngrok. */
    webhookUrl?: string;
}

/** Resposta do POST /jira/setup-webhook. */
export interface SetupWebhookResponseDto {
    success: true;
    webhookUrl: string;
    id?: number | string;
}
