/**
 * GetPMConfigUseCase — Busca statuses e tipos de issue do project manager ativo.
 * Usado para popular o formulário de mapeamento no frontend.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { ProjectManagerConfig } from '../../domain/project-manager/ProjectManagerIssue';

export type GetPMConfigResult =
    | { type: 'ok'; config: ProjectManagerConfig }
    | { type: 'no_adapter' };

export class GetPMConfigUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(): Promise<GetPMConfigResult> {
        const type = (await this.settingsRepo.findOne('project_manager')) ?? 'jira';
        const adapter = this.registry.adapters.get(type);
        if (!adapter) return { type: 'no_adapter' };

        const config = await adapter.fetchConfig();
        return { type: 'ok', config };
    }
}
