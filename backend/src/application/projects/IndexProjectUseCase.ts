/**
 * IndexProjectUseCase — Dispara a indexação de contexto de um projeto.
 *
 * A indexação é assíncrona: o use case inicia o processo em background
 * e retorna imediatamente. O resultado é persistido na memória e pode
 * ser consultado via GetRepoStatusUseCase.
 *
 * A URL do repositório pode ser fornecida diretamente no input (quando
 * chamado pelo GitTab com dados da API do GitHub) ou resolvida via
 * repo_mappings das settings (compatibilidade com fluxo legado).
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { IContextPort } from '../../domain/agent/ports/IContextPort';
import { NotFoundError } from '../../api/errors/HttpError';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'index-project-use-case' });

export interface IndexProjectInput {
  /** Identificador do projeto na memória (ex: nome do repo ou prefixo de tarefa). */
  prefix: string;
  /**
   * URL de clone do repositório.
   * Se fornecida, usa diretamente — sem depender do repo_mappings.
   * Se omitida, tenta resolver via repo_mappings das settings.
   */
  repoUrl?: string;
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
    let repoUrl = input.repoUrl?.trim();

    // Fallback: resolve via repo_mappings se URL não foi fornecida
    if (!repoUrl) {
      const settings = await this.settingsRepo.findAll();
      const repoMappings: Record<string, string> = settings['repo_mappings']
        ? JSON.parse(settings['repo_mappings'])
        : {};
      repoUrl = repoMappings[input.prefix];
    }

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
