/**
 * ProcessWebhookUseCase — Processa um webhook recebido do project manager.
 *
 * Encaminha o payload (com metadados de assinatura) para o adapter ativo.
 * A validação HMAC é responsabilidade do adapter — este use case apenas
 * roteia para o provedor correto.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';

export interface ProcessWebhookInput {
    body: unknown;
    signature?: string;
    rawBody: string;
    /** Se fornecido, usa este adapter diretamente (ex: rota /jira/webhook). */
    adapterType?: string;
}

export type ProcessWebhookResult =
    | { type: 'ok' }
    | { type: 'no_adapter' }
    | { type: 'unauthorized'; message: string };

export class ProcessWebhookUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(input: ProcessWebhookInput): Promise<ProcessWebhookResult> {
        const adapterType = input.adapterType
            ?? (await this.settingsRepo.findOne('project_manager'))
            ?? 'jira';

        const adapter = this.registry.adapters.get(adapterType);
        if (!adapter) return { type: 'no_adapter' };

        try {
            await adapter.processWebhook({
                body: input.body,
                signature: input.signature,
                rawBody: input.rawBody,
            });
            return { type: 'ok' };
        } catch (e: unknown) {
            const msg = (e as Error)?.message ?? String(e);
            if (msg.includes('assinatura')) {
                return { type: 'unauthorized', message: msg };
            }
            throw e;
        }
    }
}
