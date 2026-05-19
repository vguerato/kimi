/**
 * ListGitRepositoriesUseCase — Lista repositórios acessíveis via PAT do GitHub.
 *
 * Usa a API do GitHub para buscar todos os repos do usuário autenticado
 * (próprios + organizações). Retorna nome, URL, visibilidade e status de
 * indexação na memória do agente.
 *
 * O status de indexação é verificado diretamente na memória usando repo.name
 * como repoId — independente do repo_mappings das settings.
 *
 * Lança ServiceUnavailableError se o PAT não estiver configurado.
 */

import { Octokit } from '@octokit/rest';
import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { IMemoryPort } from '../../domain/agent/ports/IMemoryPort';
import { ServiceUnavailableError } from '../../api/errors/HttpError';

export interface GitRepository {
    /** Nome curto do repositório (ex: "meu-projeto"). */
    name: string;
    /** Nome completo: owner/repo. */
    fullName: string;
    /** URL de clone HTTPS. */
    cloneUrl: string;
    /** URL web do repositório. */
    webUrl: string;
    /** Descrição do repositório. */
    description: string | null;
    /** Se o repositório é privado. */
    private: boolean;
    /** Linguagem principal detectada pelo GitHub. */
    language: string | null;
    /** Data do último push no GitHub (ISO string). */
    pushedAt: string | null;
    /** Se o contexto está indexado na memória do agente. */
    indexed: boolean;
    /** ISO timestamp de quando o contexto foi indexado. Null se não indexado. */
    indexedAt: string | null;
    /** Se já está mapeado nas configurações (repo_mappings). */
    mapped: boolean;
    /** Prefixo atual no mapeamento (se mapeado). */
    currentPrefix: string | null;
}

export class ListGitRepositoriesUseCase {
    constructor(
        private readonly settingsRepo: ISettingsRepository,
        private readonly memory: IMemoryPort,
    ) { }

    async execute(): Promise<GitRepository[]> {
        const settings = await this.settingsRepo.findAll();
        const pat = settings['git_pat']?.trim();

        if (!pat) {
            throw new ServiceUnavailableError('Git PAT não configurado.');
        }

        const octokit = new Octokit({ auth: pat });

        // Busca todos os repos acessíveis (próprios + orgs), paginando
        const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
            per_page: 100,
            sort: 'pushed',
            direction: 'desc',
            affiliation: 'owner,collaborator,organization_member',
        });

        // Mapeamentos atuais para marcar repos já configurados
        const repoMappings: Record<string, string> = settings['repo_mappings']
            ? JSON.parse(settings['repo_mappings'])
            : {};

        // Inverte o mapa: cloneUrl → prefix
        const urlToPrefix = new Map(
            Object.entries(repoMappings).map(([prefix, url]) => [url, prefix])
        );

        // Verifica indexação na memória para cada repo pelo seu nome (repoId)
        // Não depende do mapeamento — usa repo.name diretamente como repoId
        const contextResults = await Promise.all(
            repos.map(repo => this.memory.getProjectContext(repo.name))
        );

        return repos.map((repo, i) => {
            const cloneUrl = repo.clone_url;
            const currentPrefix = urlToPrefix.get(cloneUrl) ?? null;
            const ctx = contextResults[i];

            return {
                name: repo.name,
                fullName: repo.full_name,
                cloneUrl,
                webUrl: repo.html_url,
                description: repo.description ?? null,
                private: repo.private,
                language: repo.language ?? null,
                pushedAt: repo.pushed_at ?? null,
                indexed: !!ctx,
                indexedAt: ctx?.indexedAt ?? null,
                mapped: !!currentPrefix,
                currentPrefix,
            };
        });
    }
}
