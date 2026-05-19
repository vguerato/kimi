/**
 * GetRepoStatusUseCase — Retorna o status de indexação de cada repositório.
 *
 * No v2 não há clone local. O status reflete se o contexto do projeto
 * foi indexado na memória semântica:
 *   'ready'   → contexto disponível para o agente
 *   'pending' → ainda não indexado
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { IMemoryPort } from '../../domain/agent/ports/IMemoryPort';

export type RepoIndexStatus = 'ready' | 'pending';

export class GetRepoStatusUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly memory: IMemoryPort,
    ) { }

    async execute(): Promise<Record<string, RepoIndexStatus>> {
        const settings = await this.settingsRepo.findAll();
        const repoMappings: Record<string, string> = settings['repo_mappings']
            ? JSON.parse(settings['repo_mappings'])
            : {};

        const statusMap: Record<string, RepoIndexStatus> = {};

        await Promise.all(
            Object.keys(repoMappings).map(async (prefix) => {
                const context = await this.memory.getProjectContext(prefix);
                statusMap[prefix] = context ? 'ready' : 'pending';
            }),
        );

        return statusMap;
    }
}
