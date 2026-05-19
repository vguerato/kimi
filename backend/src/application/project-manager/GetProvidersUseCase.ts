/**
 * GetProvidersUseCase — Lista os provedores de gerenciamento de projetos disponíveis.
 */

import { ProjectManagerRegistry } from '../../infrastructure/project-manager/ProjectManagerRegistry';

export class GetProvidersUseCase {
    constructor(private readonly registry: ProjectManagerRegistry) { }

    execute() {
        return this.registry.getAvailableProviders();
    }
}
