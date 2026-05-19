/**
 * SetupWebhookUseCase — Registra um webhook no provedor de project manager.
 *
 * Se webhookUrl não for fornecida, usa a URL pública do Ngrok com o path
 * correto para o provedor especificado.
 *
 * Lança ServiceUnavailableError se o adapter não estiver registrado.
 * Lança BadRequestError se o Ngrok não estiver ativo e nenhuma URL for fornecida,
 * ou se o provedor retornar erro ao criar o webhook.
 *
 * Paths por provedor:
 *   jira         → /api/project-manager/jira/webhook
 *   azure-devops → /api/project-manager/azure-devops/webhook
 *   (padrão)     → /api/project-manager/webhook
 */

import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { getNgrokUrl } from '../../shared/ngrok-state';
import { BadRequestError, ServiceUnavailableError } from '../../api/errors/HttpError';

export interface SetupWebhookInput {
    /** URL explícita do webhook. Se omitida, usa a URL do Ngrok. */
    webhookUrl?: string;
    /** Tipo do provedor. Se omitido, usa 'jira'. */
    providerType?: string;
}

export interface SetupWebhookOutput {
    webhookUrl: string;
    id?: number | string;
}

/** Paths de webhook por provedor. */
const WEBHOOK_PATHS: Record<string, string> = {
    'jira': '/api/project-manager/jira/webhook',
    'azure-devops': '/api/project-manager/azure-devops/webhook',
};

export class SetupWebhookUseCase {
    constructor(private readonly registry: ProjectManagerRegistry) { }

    async execute(input: SetupWebhookInput): Promise<SetupWebhookOutput> {
        const providerType = input.providerType ?? 'jira';
        const adapter = this.registry.adapters.get(providerType);

        if (!adapter) {
            throw new ServiceUnavailableError(
                `Adapter "${providerType}" não registrado. Verifique as configurações.`,
            );
        }

        // Resolve a URL do webhook
        let webhookUrl = input.webhookUrl;
        if (!webhookUrl) {
            const ngrokUrl = getNgrokUrl();
            if (!ngrokUrl) {
                throw new BadRequestError(
                    'Tunnel Ngrok não está ativo. Configure NGROK_AUTHTOKEN ou forneça webhookUrl.',
                );
            }
            const path = WEBHOOK_PATHS[providerType] ?? '/api/project-manager/webhook';
            webhookUrl = `${ngrokUrl}${path}`;
        }

        const result = await adapter.createWebhook(webhookUrl);

        if (!result.success) {
            throw new BadRequestError(
                result.error ?? `Falha ao registrar webhook no provedor "${providerType}".`,
            );
        }

        return { webhookUrl, id: result.id };
    }
}
