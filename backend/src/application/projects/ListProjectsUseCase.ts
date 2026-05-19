/**
 * ListProjectsUseCase — Lista todos os projetos configurados com status de contexto.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { IMemoryPort } from '../../domain/agent/ports/IMemoryPort';

export interface ProjectSummary {
    prefix: string;
    url: string;
    hasContext: boolean;
    language?: string;
    framework?: string;
    confidence?: number;
}

export class ListProjectsUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly memory: IMemoryPort,
    ) { }

    async execute(): Promise<ProjectSummary[]> {
        const settings = await this.settingsRepo.findAll();
        const repoMappings: Record<string, string> = settings['repo_mappings']
            ? JSON.parse(settings['repo_mappings'])
            : {};

        return Promise.all(
            Object.entries(repoMappings).map(async ([prefix, url]) => {
                const context = await this.memory.getProjectContext(prefix);
                return {
                    prefix,
                    url,
                    hasContext: !!context,
                    language: context?.language,
                    framework: context?.framework,
                    confidence: context?.confidence,
                };
            }),
        );
    }
}
