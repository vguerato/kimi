/**
 * IndexProjectUseCase — Dispara a indexação de contexto de um projeto.
 *
 * A indexação é assíncrona: o use case inicia o processo em background
 * e retorna imediatamente. O resultado da indexação é persistido na memória
 * e pode ser consultado via GetRepoStatusUseCase.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { IContextPort } from '../../domain/agent/ports/IContextPort';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'index-project-use-case' });

export interface IndexProjectInput {
    prefix: string;
}

export type IndexProjectResult =
    | { type: 'started' }
    | { type: 'not_found' };

export class IndexProjectUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly contextEngine: IContextPort,
    ) { }

    async execute(input: IndexProjectInput): Promise<IndexProjectResult> {
        const settings = await this.settingsRepo.findAll();
        const repoMappings: Record<string, string> = settings['repo_mappings']
            ? JSON.parse(settings['repo_mappings'])
            : {};

        const repoUrl = repoMappings[input.prefix];
        if (!repoUrl) {
            return { type: 'not_found' };
        }

        // Dispara em background — não bloqueia a resposta HTTP
        this.contextEngine.indexProject(input.prefix, repoUrl)
            .then(result => log.info({ prefix: input.prefix, success: result.success }, 'Indexação concluída'))
            .catch(err => log.error({ err, prefix: input.prefix }, 'Indexação falhou'));

        return { type: 'started' };
    }
}
