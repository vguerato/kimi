/**
 * VCSAdapterRegistry — Fábrica e registro de adapters VCS.
 *
 * Detecta automaticamente o provedor correto a partir da URL do repositório
 * e retorna o adapter correspondente com as credenciais configuradas.
 *
 * OCP: Adicionar um novo provedor requer apenas registrar o adapter —
 *      sem modificar lógica existente.
 */

import { IVCSAdapter } from '../../domain/project/ports/IVCSAdapter';
import { VCSProvider, VCSProviderType } from '../../domain/project/value-objects/VCSProvider';
import { GitHubAdapter } from './GitHubAdapter';
import { AzureDevOpsAdapter } from './AzureDevOpsAdapter';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'vcs-registry' });

type AdapterFactory = (token: string) => IVCSAdapter;

export class VCSAdapterRegistry {
    private readonly factories = new Map<VCSProviderType, AdapterFactory>();

    constructor() {
        // Registro dos adapters disponíveis
        this.factories.set('github', (token) => new GitHubAdapter(token));
        this.factories.set('azure-devops', (token) => new AzureDevOpsAdapter(token));
        // gitlab e bitbucket podem ser adicionados aqui sem modificar o resto
    }

    /**
     * Retorna o adapter correto para a URL do repositório.
     * Detecta o provedor automaticamente pela URL.
     */
    getForUrl(repoUrl: string, token: string): IVCSAdapter {
        const provider = VCSProvider.fromUrl(repoUrl);
        return this.getForProvider(provider.value, token);
    }

    /**
     * Retorna o adapter para um tipo de provedor específico.
     */
    getForProvider(providerType: VCSProviderType, token: string): IVCSAdapter {
        const factory = this.factories.get(providerType);

        if (!factory) {
            log.warn({ providerType }, 'Provedor VCS não suportado — usando GitHub como fallback');
            return new GitHubAdapter(token);
        }

        return factory(token);
    }

    /** Retorna os provedores suportados. */
    getSupportedProviders(): VCSProviderType[] {
        return [...this.factories.keys()];
    }
}

/** Singleton — instanciado uma vez no bootstrap. */
export const vcsRegistry = new VCSAdapterRegistry();
