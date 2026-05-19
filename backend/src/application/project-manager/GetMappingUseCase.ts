/**
 * GetMappingUseCase — Retorna o mapeamento de status/tipos configurado.
 * Agnóstico de provedor — usa o adapter ativo.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { ProjectManagerMapping } from '../../domain/project-manager/ProjectManagerIssue';

export type GetMappingResult =
    | { type: 'ok'; mapping: ProjectManagerMapping | null }
    | { type: 'no_adapter' };

export class GetMappingUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(): Promise<GetMappingResult> {
        const type = (await this.settingsRepo.findOne('project_manager')) ?? 'jira';
        const adapter = this.registry.adapters.get(type);
        if (!adapter) return { type: 'no_adapter' };

        const mapping = await adapter.getMapping();
        return { type: 'ok', mapping };
    }
}
