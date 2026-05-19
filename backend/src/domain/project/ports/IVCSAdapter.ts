/**
 * IVCSAdapter — Port para operações de controle de versão.
 *
 * Abstrai completamente o provedor VCS (GitHub, Azure DevOps, GitLab, etc.).
 * Todas as operações são feitas via API — sem clone local de repositórios.
 *
 * Implementações concretas vivem em infrastructure/vcs/.
 * O domínio e a camada de aplicação dependem apenas desta interface (DIP).
 */

export interface FileContent {
    /** Caminho relativo do arquivo no repositório. */
    path: string;
    /** Conteúdo do arquivo em texto. */
    content: string;
    /** SHA do blob (usado para updates via API). */
    sha?: string;
    /** Encoding do conteúdo retornado pela API. */
    encoding?: string;
}

export interface FileEntry {
    path: string;
    type: 'file' | 'dir' | 'symlink';
    size?: number;
}

export interface CommitResult {
    sha: string;
    url: string;
    message: string;
}

export interface PullRequestResult {
    id: number | string;
    url: string;
    title: string;
    state: string;
}

export interface RepositoryMetadata {
    name: string;
    fullName: string;
    defaultBranch: string;
    description?: string;
    language?: string;
    isPrivate: boolean;
    cloneUrl: string;
    webUrl: string;
}

export interface BranchInfo {
    name: string;
    sha: string;
    isDefault: boolean;
}

export interface IVCSAdapter {
    /** Tipo do provedor (para logging e diagnóstico). */
    readonly providerType: string;

    /** Retorna metadados do repositório (branch padrão, linguagem, etc.). */
    getRepositoryMetadata(repoUrl: string): Promise<RepositoryMetadata>;

    /** Lista arquivos e diretórios em um caminho, opcionalmente em uma ref específica. */
    listFiles(repoUrl: string, path?: string, ref?: string): Promise<FileEntry[]>;

    /** Retorna o conteúdo de um arquivo específico. */
    getFileContent(repoUrl: string, filePath: string, ref?: string): Promise<FileContent>;

    /**
     * Retorna o conteúdo de múltiplos arquivos em paralelo.
     * Arquivos não encontrados são omitidos do resultado.
     */
    getMultipleFiles(repoUrl: string, paths: string[], ref?: string): Promise<FileContent[]>;

    /** Cria uma nova branch a partir de uma ref base. */
    createBranch(repoUrl: string, branchName: string, fromRef: string): Promise<BranchInfo>;

    /** Verifica se uma branch existe. */
    branchExists(repoUrl: string, branchName: string): Promise<boolean>;

    /**
     * Commita múltiplos arquivos em uma única operação atômica.
     * Cria ou atualiza os arquivos na branch especificada.
     */
    commitFiles(
        repoUrl: string,
        branch: string,
        files: Array<{ path: string; content: string }>,
        message: string,
    ): Promise<CommitResult>;

    /** Abre um Pull Request / Merge Request. */
    openPullRequest(
        repoUrl: string,
        title: string,
        body: string,
        headBranch: string,
        baseBranch: string,
    ): Promise<PullRequestResult>;

    /** Valida que as credenciais configuradas têm acesso ao repositório. */
    validateAccess(repoUrl: string): Promise<boolean>;
}
