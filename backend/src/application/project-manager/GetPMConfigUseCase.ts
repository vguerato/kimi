/**
 * GetPMConfigUseCase — Busca statuses e tipos de issue do project manager ativo.
 *
 * Lança ServiceUnavailableError se nenhum adapter estiver registrado.
 * Usado para popular o formulário de mapeamento no frontend.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { ProjectManagerConfig } from '../../domain/project-manager/ProjectManagerIssue';
import { ServiceUnavailableError } from '../../api/errors/HttpError';

export class GetPMConfigUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(): Promise<ProjectManagerConfig> {
        const type = (await this.settingsRepo.findOne('project_manager')) ?? 'jira';
        const adapter = this.registry.adapters.get(type);

        if (!adapter) {
            throw new ServiceUnavailableError(
                `Adapter de project manager "${type}" não registrado. Verifique as configurações.`,
            );
        }

        return adapter.fetchConfig();
    }
}
