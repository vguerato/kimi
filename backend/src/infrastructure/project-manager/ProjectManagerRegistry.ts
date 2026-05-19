/**
 * ProjectManagerRegistry — Registro de adapters de gerenciamento de projetos.
 *
 * OCP: Aberto para extensão (registrar novos adapters), fechado para modificação.
 *      Adicionar um novo provedor requer apenas registrar o adapter — sem if/else.
 *
 * DIP: Depende de IProjectManagerAdapter (port de domínio), não de implementações.
 *
 * Provedores suportados:
 *   - jira        → Atlassian Jira (implementado)
 *   - azure-devops → Azure DevOps (registrado, aguarda implementação do adapter)
 *
 * Para adicionar um novo provedor:
 *   1. Crie o adapter em infrastructure/project-manager/<provider>/
 *   2. Implemente IProjectManagerAdapter
 *   3. Registre em bootstrap/container.ts via registry.register(type, adapter)
 *   4. Adicione à lista de getAvailableProviders() abaixo
 */

import { injectable } from 'tsyringe';
import {
  IProjectManagerAdapter,
  ProjectManagerType,
} from '../../domain/project-manager/IProjectManagerAdapter';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'project-manager-registry' });

@injectable()
export class ProjectManagerRegistry {
  /** Mapa de adapters registrados. Exposto para acesso no container. */
  readonly adapters = new Map<string, IProjectManagerAdapter>();

  /**
   * Registra um adapter para um tipo de provedor.
   * Chamado uma vez durante o bootstrap — não em tempo de requisição.
   */
  register(type: ProjectManagerType, adapter: IProjectManagerAdapter): void {
    this.adapters.set(type, adapter);
    log.debug({ type }, 'Adapter de project manager registrado');
  }

  /**
   * Retorna o adapter para o tipo especificado.
   * Lança erro se o tipo não estiver registrado.
   */
  getAdapter(type: string): IProjectManagerAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      const available = [...this.adapters.keys()].join(', ');
      throw new Error(`Adapter "${type}" não registrado. Disponíveis: ${available}`);
    }
    return adapter;
  }

  /**
   * Retorna todos os provedores suportados com status de registro.
   *
   * `registered: true` indica que o adapter está disponível para uso.
   * `registered: false` indica que o provedor é reconhecido mas ainda
   * não tem um adapter registrado (ex: Azure DevOps em desenvolvimento).
   */
  getAvailableProviders(): Array<{ type: string; label: string; registered: boolean }> {
    return [
      { type: 'jira', label: 'Jira (Atlassian)', registered: this.adapters.has('jira') },
      { type: 'azure-devops', label: 'Azure DevOps', registered: this.adapters.has('azure-devops') },
    ];
  }
}
