/**
 * GetMappingUseCase — Retorna o mapeamento de status/tipos configurado.
 *
 * Aceita um `adapterType` opcional para operar em um provedor específico.
 * Se não fornecido, usa o provedor configurado nas settings.
 * Lança ServiceUnavailableError se nenhum adapter estiver registrado.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';
import { ProjectManagerMapping } from '../../domain/project-manager/ProjectManagerIssue';
import { ServiceUnavailableError } from '../../api/errors/HttpError';

export class GetMappingUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly registry: ProjectManagerRegistry,
    ) { }

    async execute(adapterType?: string): Promise<ProjectManagerMapping | null> {
        const type = adapterType ?? (await this.settingsRepo.findOne('project_manager')) ?? 'jira';
        const adapter = this.registry.adapters.get(type);

        if (!adapter) {
            throw new ServiceUnavailableError(
                `Adapter de project manager "${type}" não registrado. Verifique as configurações.`,
            );
        }

        return adapter.getMapping();
    }
}
