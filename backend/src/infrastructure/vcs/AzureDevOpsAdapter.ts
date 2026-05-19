/**
 * AzureDevOpsAdapter — Implementação de IVCSAdapter para Azure DevOps.
 *
 * Usa a API REST do Azure DevOps via axios — sem clone local.
 * Suporta tanto Azure DevOps Services (dev.azure.com) quanto Server.
 *
 * Autenticação: Personal Access Token (PAT) via Basic Auth.
 */

import axios, { AxiosInstance } from 'axios';
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

const log = logger.child({ module: 'azure-devops-adapter' });

interface AzureRepoInfo {
    organization: string;
    project: string;
    repo: string;
    baseUrl: string;
}

/**
 * Extrai informações de uma URL do Azure DevOps.
 * Suporta: https://dev.azure.com/{org}/{project}/_git/{repo}
 */
function parseAzureUrl(repoUrl: string): AzureRepoInfo {
    const match = repoUrl.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)/);
    if (!match) throw new Error(`URL inválida para Azure DevOps: ${repoUrl}`);
    return {
        organization: match[1],
        project: match[2],
        repo: match[3],
        baseUrl: `https://dev.azure.com/${match[1]}`,
    };
}

export class AzureDevOpsAdapter implements IVCSAdapter {
    readonly providerType = 'azure-devops';

    private readonly http: AxiosInstance;

    constructor(token: string) {
        // Azure DevOps usa Basic Auth com PAT: base64(":{token}")
        const encoded = Buffer.from(`:${token}`).toString('base64');
        this.http = axios.create({
            timeout: 15_000,
            headers: {
                Authorization: `Basic ${encoded}`,
                'Content-Type': 'application/json',
            },
        });
    }

    async getRepositoryMetadata(repoUrl: string): Promise<RepositoryMetadata> {
        const { organization, project, repo, baseUrl } = parseAzureUrl(repoUrl);
        const url = `${baseUrl}/${project}/_apis/git/repositories/${repo}?api-version=7.0`;
        const { data } = await this.http.get(url);

        return {
            name: data.name,
            fullName: `${organization}/${project}/${data.name}`,
            defaultBranch: data.defaultBranch?.replace('refs/heads/', '') ?? 'main',
            isPrivate: true, // Azure DevOps repos são sempre privados
            cloneUrl: data.remoteUrl,
            webUrl: data.webUrl,
        };
    }

    async listFiles(repoUrl: string, path = '', ref?: string): Promise<FileEntry[]> {
        const { project, repo, baseUrl } = parseAzureUrl(repoUrl);
        const scopePath = path ? `&scopePath=${encodeURIComponent(path)}` : '';
        const versionParam = ref ? `&versionDescriptor.version=${ref}` : '';
        const url = `${baseUrl}/${project}/_apis/git/repositories/${repo}/items?recursionLevel=OneLevel${scopePath}${versionParam}&api-version=7.0`;

        try {
            const { data } = await this.http.get(url);
            return (data.value ?? []).map((item: any) => ({
                path: item.path,
                type: item.isFolder ? 'dir' : 'file',
                size: item.contentMetadata?.contentType ? undefined : item.size,
            }));
        } catch (err: any) {
            if (err?.response?.status === 404) return [];
            throw err;
        }
    }

    async getFileContent(repoUrl: string, filePath: string, ref?: string): Promise<FileContent> {
        const { project, repo, baseUrl } = parseAzureUrl(repoUrl);
        const versionParam = ref ? `&versionDescriptor.version=${ref}` : '';
        const url = `${baseUrl}/${project}/_apis/git/repositories/${repo}/items?path=${encodeURIComponent(filePath)}${versionParam}&api-version=7.0`;

        const { data } = await this.http.get(url, { responseType: 'text' });
        return { path: filePath, content: String(data) };
    }

    async getMultipleFiles(repoUrl: string, paths: string[], ref?: string): Promise<FileContent[]> {
        const results = await Promise.allSettled(
            paths.map(p => this.getFileContent(repoUrl, p, ref))
        );
        return results
            .filter((r): r is PromiseFulfilledResult<FileContent> => r.status === 'fulfilled')
            .map(r => r.value);
    }

    async createBranch(repoUrl: string, branchName: string, fromRef: string): Promise<BranchInfo> {
        const { project, repo, baseUrl } = parseAzureUrl(repoUrl);

        // Obtém o SHA da ref base
        const refUrl = `${baseUrl}/${project}/_apis/git/repositories/${repo}/refs?filter=heads/${fromRef}&api-version=7.0`;
        const { data: refData } = await this.http.get(refUrl);
        const sha = refData.value?.[0]?.objectId;
        if (!sha) throw new Error(`Branch base não encontrada: ${fromRef}`);

        // Cria a nova branch
        const createUrl = `${baseUrl}/${project}/_apis/git/repositories/${repo}/refs?api-version=7.0`;
        await this.http.post(createUrl, [{
            name: `refs/heads/${branchName}`,
            newObjectId: sha,
            oldObjectId: '0000000000000000000000000000000000000000',
        }]);

        log.info({ repo, branch: branchName, fromRef }, 'Branch criada no Azure DevOps');
        return { name: branchName, sha, isDefault: false };
    }

    async branchExists(repoUrl: string, branchName: string): Promise<boolean> {
        const { project, repo, baseUrl } = parseAzureUrl(repoUrl);
        const url = `${baseUrl}/${project}/_apis/git/repositories/${repo}/refs?filter=heads/${branchName}&api-version=7.0`;
        try {
            const { data } = await this.http.get(url);
            return (data.value?.length ?? 0) > 0;
        } catch {
            return false;
        }
    }

    async commitFiles(
        repoUrl: string,
        branch: string,
        files: Array<{ path: string; content: string }>,
        message: string,
    ): Promise<CommitResult> {
        const { project, repo, baseUrl } = parseAzureUrl(repoUrl);

        // Obtém o SHA atual da branch
        const refUrl = `${baseUrl}/${project}/_apis/git/repositories/${repo}/refs?filter=heads/${branch}&api-version=7.0`;
        const { data: refData } = await this.http.get(refUrl);
        const oldObjectId = refData.value?.[0]?.objectId ?? '0000000000000000000000000000000000000000';

        const pushUrl = `${baseUrl}/${project}/_apis/git/repositories/${repo}/pushes?api-version=7.0`;
        const { data } = await this.http.post(pushUrl, {
            refUpdates: [{ name: `refs/heads/${branch}`, oldObjectId }],
            commits: [{
                comment: message,
                changes: files.map(f => ({
                    changeType: 'edit',
                    item: { path: f.path },
                    newContent: {
                        content: Buffer.from(f.content).toString('base64'),
                        contentType: 'base64Encoded',
                    },
                })),
            }],
        });

        const sha = data.commits?.[0]?.commitId ?? '';
        const webUrl = `${baseUrl}/${project}/_git/${repo}/commit/${sha}`;

        log.info({ repo, branch, files: files.length, sha }, 'Commit criado no Azure DevOps');
        return { sha, url: webUrl, message };
    }

    async openPullRequest(
        repoUrl: string,
        title: string,
        body: string,
        headBranch: string,
        baseBranch: string,
    ): Promise<PullRequestResult> {
        const { project, repo, baseUrl } = parseAzureUrl(repoUrl);
        const url = `${baseUrl}/${project}/_apis/git/repositories/${repo}/pullrequests?api-version=7.0`;

        const { data } = await this.http.post(url, {
            title,
            description: body,
            sourceRefName: `refs/heads/${headBranch}`,
            targetRefName: `refs/heads/${baseBranch}`,
        });

        log.info({ repo, pr: data.pullRequestId, title }, 'Pull Request aberto no Azure DevOps');
        return {
            id: data.pullRequestId,
            url: data.url,
            title: data.title,
            state: data.status,
        };
    }

    async validateAccess(repoUrl: string): Promise<boolean> {
        try {
            await this.getRepositoryMetadata(repoUrl);
            return true;
        } catch (err: any) {
            log.warn({ repoUrl, status: err?.response?.status }, 'Validação de acesso Azure DevOps falhou');
            return false;
        }
    }
}
