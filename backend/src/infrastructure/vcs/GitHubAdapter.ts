/**
 * GitHubAdapter — Implementação de IVCSAdapter para GitHub.
 *
 * Usa a API REST do GitHub via Octokit — sem clone local de repositórios.
 * Todas as operações (leitura, escrita, branches, PRs) são feitas via HTTP.
 *
 * Autenticação: Personal Access Token (PAT) com escopo 'repo'.
 *
 * Por que API-first?
 *   - Zero armazenamento local de código
 *   - Sem preocupações de espaço em disco ou segurança de arquivos
 *   - Operações atômicas (commit de múltiplos arquivos em uma chamada)
 *   - Suporte nativo a repositórios privados sem configuração extra
 */

import { Octokit } from '@octokit/rest';
import { logger } from '../../config/logger';
import {
    IVCSAdapter,
    FileContent,
    FileEntry,
    CommitResult,
    PullRequestResult,
    RepositoryMetadata,
    BranchInfo,
} from '../../domain/project/ports/IVCSAdapter';

const log = logger.child({ module: 'github-adapter' });

/** Extrai owner e repo de uma URL do GitHub. */
function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
    // Suporta: https://github.com/owner/repo, https://github.com/owner/repo.git
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) throw new Error(`URL inválida para GitHub: ${repoUrl}`);
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export class GitHubAdapter implements IVCSAdapter {
    readonly providerType = 'github';

    private readonly octokit: Octokit;

    constructor(token: string) {
        this.octokit = new Octokit({ auth: token });
    }

    // ─── Metadados ───────────────────────────────────────────────────────────────

    async getRepositoryMetadata(repoUrl: string): Promise<RepositoryMetadata> {
        const { owner, repo } = parseGitHubUrl(repoUrl);
        const { data } = await this.octokit.repos.get({ owner, repo });

        return {
            name: data.name,
            fullName: data.full_name,
            defaultBranch: data.default_branch,
            description: data.description ?? undefined,
            language: data.language ?? undefined,
            isPrivate: data.private,
            cloneUrl: data.clone_url,
            webUrl: data.html_url,
        };
    }

    // ─── Listagem de arquivos ────────────────────────────────────────────────────

    async listFiles(repoUrl: string, path = '', ref?: string): Promise<FileEntry[]> {
        const { owner, repo } = parseGitHubUrl(repoUrl);

        try {
            const { data } = await this.octokit.repos.getContent({
                owner,
                repo,
                path,
                ...(ref ? { ref } : {}),
            });

            if (!Array.isArray(data)) {
                // Arquivo único retornado — não é um diretório
                return [{
                    path: (data as any).path,
                    type: 'file',
                    size: (data as any).size,
                }];
            }

            return data.map((item: any) => ({
                path: item.path,
                type: item.type as 'file' | 'dir' | 'symlink',
                size: item.size,
            }));
        } catch (err: any) {
            if (err?.status === 404) return [];
            throw err;
        }
    }

    // ─── Conteúdo de arquivos ────────────────────────────────────────────────────

    async getFileContent(repoUrl: string, filePath: string, ref?: string): Promise<FileContent> {
        const { owner, repo } = parseGitHubUrl(repoUrl);

        const { data } = await this.octokit.repos.getContent({
            owner,
            repo,
            path: filePath,
            ...(ref ? { ref } : {}),
        }) as any;

        if (Array.isArray(data)) {
            throw new Error(`Caminho "${filePath}" é um diretório, não um arquivo.`);
        }

        const content = data.encoding === 'base64'
            ? Buffer.from(data.content, 'base64').toString('utf-8')
            : data.content;

        return {
            path: data.path,
            content,
            sha: data.sha,
            encoding: data.encoding,
        };
    }

    async getMultipleFiles(repoUrl: string, paths: string[], ref?: string): Promise<FileContent[]> {
        // Busca em paralelo — arquivos não encontrados são omitidos
        const results = await Promise.allSettled(
            paths.map(p => this.getFileContent(repoUrl, p, ref))
        );

        return results
            .filter((r): r is PromiseFulfilledResult<FileContent> => r.status === 'fulfilled')
            .map(r => r.value);
    }

    // ─── Branches ────────────────────────────────────────────────────────────────

    async createBranch(repoUrl: string, branchName: string, fromRef: string): Promise<BranchInfo> {
        const { owner, repo } = parseGitHubUrl(repoUrl);

        // Resolve o SHA da ref base
        const { data: refData } = await this.octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${fromRef}`,
        });

        const sha = refData.object.sha;

        await this.octokit.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha,
        });

        log.info({ repo: `${owner}/${repo}`, branch: branchName, fromRef }, 'Branch criada');

        return { name: branchName, sha, isDefault: false };
    }

    async branchExists(repoUrl: string, branchName: string): Promise<boolean> {
        const { owner, repo } = parseGitHubUrl(repoUrl);
        try {
            await this.octokit.git.getRef({ owner, repo, ref: `heads/${branchName}` });
            return true;
        } catch (err: any) {
            if (err?.status === 404) return false;
            throw err;
        }
    }

    // ─── Commits ─────────────────────────────────────────────────────────────────

    /**
     * Commita múltiplos arquivos atomicamente via Git Data API.
     *
     * Fluxo da Git Data API:
     *   1. Cria blobs para cada arquivo
     *   2. Cria uma tree com todos os blobs
     *   3. Cria um commit apontando para a tree
     *   4. Atualiza a ref da branch
     *
     * Isso garante que todos os arquivos são commitados em uma única operação,
     * sem estados intermediários inconsistentes.
     */
    async commitFiles(
        repoUrl: string,
        branch: string,
        files: Array<{ path: string; content: string }>,
        message: string,
    ): Promise<CommitResult> {
        const { owner, repo } = parseGitHubUrl(repoUrl);

        // 1. Obtém o SHA atual da branch
        const { data: branchData } = await this.octokit.repos.getBranch({ owner, repo, branch });
        const baseTreeSha = branchData.commit.commit.tree.sha;
        const parentSha = branchData.commit.sha;

        // 2. Cria blobs para cada arquivo em paralelo
        const blobs = await Promise.all(
            files.map(async (file) => {
                const { data } = await this.octokit.git.createBlob({
                    owner,
                    repo,
                    content: Buffer.from(file.content).toString('base64'),
                    encoding: 'base64',
                });
                return { path: file.path, sha: data.sha };
            })
        );

        // 3. Cria a tree com todos os blobs
        const { data: treeData } = await this.octokit.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: blobs.map(b => ({
                path: b.path,
                mode: '100644' as const,
                type: 'blob' as const,
                sha: b.sha,
            })),
        });

        // 4. Cria o commit
        const { data: commitData } = await this.octokit.git.createCommit({
            owner,
            repo,
            message,
            tree: treeData.sha,
            parents: [parentSha],
        });

        // 5. Atualiza a ref da branch
        await this.octokit.git.updateRef({
            owner,
            repo,
            ref: `heads/${branch}`,
            sha: commitData.sha,
        });

        const commitUrl = `https://github.com/${owner}/${repo}/commit/${commitData.sha}`;
        log.info({ repo: `${owner}/${repo}`, branch, files: files.length, sha: commitData.sha }, 'Commit criado');

        return {
            sha: commitData.sha,
            url: commitUrl,
            message,
        };
    }

    // ─── Pull Requests ───────────────────────────────────────────────────────────

    async openPullRequest(
        repoUrl: string,
        title: string,
        body: string,
        headBranch: string,
        baseBranch: string,
    ): Promise<PullRequestResult> {
        const { owner, repo } = parseGitHubUrl(repoUrl);

        const { data } = await this.octokit.pulls.create({
            owner,
            repo,
            title,
            body,
            head: headBranch,
            base: baseBranch,
        });

        log.info({ repo: `${owner}/${repo}`, pr: data.number, title }, 'Pull Request aberto');

        return {
            id: data.number,
            url: data.html_url,
            title: data.title,
            state: data.state,
        };
    }

    // ─── Validação ───────────────────────────────────────────────────────────────

    async validateAccess(repoUrl: string): Promise<boolean> {
        try {
            await this.getRepositoryMetadata(repoUrl);
            return true;
        } catch (err: any) {
            log.warn({ repoUrl, status: err?.status }, 'Validação de acesso falhou');
            return false;
        }
    }
}
