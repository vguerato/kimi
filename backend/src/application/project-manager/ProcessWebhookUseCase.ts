/**
 * ProcessWebhookUseCase — Processa um webhook recebido do project manager.
 *
 * Roteia o payload para o adapter correto (por tipo explícito ou configuração ativa).
 * A validação HMAC é responsabilidade do adapter.
 *
 * Lança ServiceUnavailableError se o adapter não estiver registrado.
 * Lança UnauthorizedError se a assinatura HMAC for inválida.
 * Propaga qualquer outro erro do adapter sem modificação.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { ServiceUnavailableError, UnauthorizedError } from '../../api/errors/HttpError';

export interface ProcessWebhookInput {
    body: unknown;
    signature?: string;
    rawBody: string;
    /** Se fornecido, usa este adapter diretamente em vez do ativo nas settings. */
    adapterType?: string;
}

export class ProcessWebhookUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(input: ProcessWebhookInput): Promise<void> {
        const adapterType = input.adapterType
            ?? (await this.settingsRepo.findOne('project_manager'))
            ?? 'jira';

        const adapter = this.registry.adapters.get(adapterType);

        if (!adapter) {
            throw new ServiceUnavailableError(
                `Adapter de project manager "${adapterType}" não registrado. Verifique as configurações.`,
            );
        }

        try {
            await adapter.processWebhook({
                body: input.body,
                signature: input.signature,
                rawBody: input.rawBody,
            });
        } catch (e: unknown) {
            const msg = (e as Error)?.message ?? String(e);
            if (msg.includes('assinatura')) {
                throw new UnauthorizedError(msg);
            }
            throw e;
        }
    }
}
