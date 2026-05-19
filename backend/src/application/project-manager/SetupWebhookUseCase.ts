/**
 * SetupWebhookUseCase — Registra um webhook no Jira.
 *
 * Se webhookUrl não for fornecida, usa a URL pública do Ngrok.
 * Retorna erro se o Ngrok não estiver ativo e nenhuma URL for fornecida.
 */

import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { getNgrokUrl } from '../../shared/ngrok-state';

export interface SetupWebhookInput {
    /** URL explícita do webhook. Se omitida, usa a URL do Ngrok. */
    webhookUrl?: string;
}

export type SetupWebhookResult =
    | { type: 'ok'; webhookUrl: string; id?: number | string }
    | { type: 'no_adapter' }
    | { type: 'no_url' }
    | { type: 'error'; message: string };

export class SetupWebhookUseCase {
    constructor(private readonly registry: ProjectManagerRegistry) { }

    async execute(input: SetupWebhookInput): Promise<SetupWebhookResult> {
        // Resolve a URL do webhook
        let webhookUrl = input.webhookUrl;
        if (!webhookUrl) {
            const ngrokUrl = getNgrokUrl();
            if (!ngrokUrl) return { type: 'no_url' };
            webhookUrl = `${ngrokUrl}/api/jira/webhook`;
        }

        const adapter = this.registry.adapters.get('jira');
        if (!adapter) return { type: 'no_adapter' };

        const result = await adapter.createWebhook(webhookUrl);
        if (!result.success) {
            return { type: 'error', message: result.error ?? 'Erro desconhecido' };
        }

        return { type: 'ok', webhookUrl, id: result.id };
    }
}
