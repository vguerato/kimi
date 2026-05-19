/**
 * VCSProvider — Value object para o provedor de controle de versão.
 *
 * Suportados: github, azure-devops, gitlab, bitbucket.
 * Extensível sem modificar código existente — basta adicionar ao tipo.
 */

export type VCSProviderType = 'github' | 'azure-devops' | 'gitlab' | 'bitbucket' | 'generic';

export class VCSProvider {
    private constructor(readonly value: VCSProviderType) { }

    static github(): VCSProvider { return new VCSProvider('github'); }
    static azureDevOps(): VCSProvider { return new VCSProvider('azure-devops'); }
    static gitlab(): VCSProvider { return new VCSProvider('gitlab'); }
    static bitbucket(): VCSProvider { return new VCSProvider('bitbucket'); }
    static generic(): VCSProvider { return new VCSProvider('generic'); }

    /**
     * Detecta o provedor a partir da URL do repositório.
     * Retorna 'generic' se não reconhecido.
     */
    static fromUrl(url: string): VCSProvider {
        const lower = url.toLowerCase();
        if (lower.includes('github.com')) return VCSProvider.github();
        if (lower.includes('dev.azure.com') || lower.includes('visualstudio.com')) return VCSProvider.azureDevOps();
        if (lower.includes('gitlab.com') || lower.includes('gitlab.')) return VCSProvider.gitlab();
        if (lower.includes('bitbucket.org')) return VCSProvider.bitbucket();
        return VCSProvider.generic();
    }

    static fromRaw(raw: string): VCSProvider {
        const valid: VCSProviderType[] = ['github', 'azure-devops', 'gitlab', 'bitbucket', 'generic'];
        if (valid.includes(raw as VCSProviderType)) return new VCSProvider(raw as VCSProviderType);
        return VCSProvider.generic();
    }

    isGitHub(): boolean { return this.value === 'github'; }
    isAzureDevOps(): boolean { return this.value === 'azure-devops'; }
    isGitLab(): boolean { return this.value === 'gitlab'; }

    equals(other: VCSProvider): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
