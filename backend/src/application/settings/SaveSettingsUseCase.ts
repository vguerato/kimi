/**
 * SaveSettingsUseCase — Persiste configurações e valida credenciais do PM.
 *
 * Fluxo:
 *   1. Sanitiza os valores (garante que tudo é string)
 *   2. Persiste no repositório de settings
 *   3. Se credenciais de PM foram fornecidas, valida e dispara fetchConfig em background
 *
 * Retorna se as credenciais do PM são válidas (ou null se não foram fornecidas).
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'save-settings-use-case' });

export interface SaveSettingsInput {
    /** Mapa de chave/valor a persistir. Valores não-string são convertidos via JSON.stringify. */
    settings: Record<string, unknown>;
}

export interface SaveSettingsOutput {
    /** true = credenciais válidas, false = inválidas, null = não foram fornecidas */
    pmValid: boolean | null;
}

/** Chaves que indicam que credenciais de PM foram fornecidas. */
const PM_CREDENTIAL_KEYS = [
    'jira_url', 'jira_email', 'jira_token',
    'azure_devops_url', 'azure_devops_token',
];

export class SaveSettingsUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly pmRegistry: ProjectManagerRegistry,
    ) { }

    async execute(input: SaveSettingsInput): Promise<SaveSettingsOutput> {
        // 1. Sanitiza: converte todos os valores para string
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(input.settings)) {
            sanitized[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }

        // 2. Persiste
        await this.settingsRepo.upsertMany(sanitized);

        // 3. Valida credenciais do PM se fornecidas
        const hasPmCredentials = PM_CREDENTIAL_KEYS.some(k => k in input.settings && input.settings[k]);
        if (!hasPmCredentials) {
            return { pmValid: null };
        }

        let pmValid: boolean | null = null;
        try {
            const pmType = (String(input.settings['project_manager'] ?? '') ||
                (await this.settingsRepo.findOne('project_manager'))) ?? 'jira';

            const adapter = this.pmRegistry.adapters.get(pmType);
            if (adapter) {
                pmValid = await adapter.validateCredentials();

                // Dispara fetchConfig em background se credenciais válidas
                if (pmValid) {
                    adapter.fetchConfig().catch((e: unknown) =>
                        log.warn({ err: e }, 'Falha ao buscar config do project manager em background'),
                    );
                }
            }
        } catch (e) {
            log.warn({ err: e }, 'Validação de credenciais do PM falhou');
        }

        return { pmValid };
    }
}
