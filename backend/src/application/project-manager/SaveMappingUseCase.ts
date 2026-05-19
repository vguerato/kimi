/**
 * SaveMappingUseCase — Persiste o mapeamento de status/tipos do project manager.
 *
 * Lança BadRequestError se algum campo obrigatório não for um array.
 * Lança ServiceUnavailableError se nenhum adapter estiver registrado.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { ProjectManagerMapping } from '../../domain/project-manager/ProjectManagerIssue';
import { BadRequestError, ServiceUnavailableError } from '../../api/errors/HttpError';

export interface SaveMappingInput {
    triggerStatuses: string[];
    skipStatuses: string[];
    delegatableTypes: string[];
    parentTypes: string[];
    adapterType?: string;
}

export class SaveMappingUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(input: SaveMappingInput): Promise<ProjectManagerMapping> {
        // Valida que todos os campos são arrays
        const arrayFields = ['triggerStatuses', 'skipStatuses', 'delegatableTypes', 'parentTypes'] as const;
        for (const field of arrayFields) {
            if (!Array.isArray(input[field])) {
                throw new BadRequestError(`${field} deve ser um array.`);
            }
        }

        const pmType = input.adapterType ?? (await this.settingsRepo.findOne('project_manager')) ?? 'jira';
        const adapter = this.registry.adapters.get(pmType);

        if (!adapter) {
            throw new ServiceUnavailableError(
                `Adapter de project manager "${pmType}" não registrado. Verifique as configurações.`,
            );
        }

        return adapter.saveMapping(input);
    }
}
