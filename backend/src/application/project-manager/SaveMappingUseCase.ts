/**
 * SaveMappingUseCase — Persiste o mapeamento de status/tipos do project manager.
 *
 * Valida que todos os campos obrigatórios são arrays antes de persistir.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { ProjectManagerMapping } from '../../domain/project-manager/ProjectManagerIssue';

export interface SaveMappingInput {
    triggerStatuses: string[];
    skipStatuses: string[];
    delegatableTypes: string[];
    parentTypes: string[];
}

export type SaveMappingResult =
    | { type: 'ok'; mapping: ProjectManagerMapping }
    | { type: 'no_adapter' }
    | { type: 'invalid_input'; message: string };

export class SaveMappingUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(input: SaveMappingInput): Promise<SaveMappingResult> {
        // Valida que todos os campos são arrays
        const arrayFields = ['triggerStatuses', 'skipStatuses', 'delegatableTypes', 'parentTypes'] as const;
        for (const field of arrayFields) {
            if (!Array.isArray(input[field])) {
                return {
                    type: 'invalid_input',
                    message: `${field} deve ser um array.`,
                };
            }
        }

        const pmType = (await this.settingsRepo.findOne('project_manager')) ?? 'jira';
        const adapter = this.registry.adapters.get(pmType);
        if (!adapter) return { type: 'no_adapter' };

        const mapping = await adapter.saveMapping(input);
        return { type: 'ok', mapping };
    }
}
