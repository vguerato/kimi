/**
 * AzureDevOpsAdapter — Adapter do Azure DevOps para a porta IProjectManagerAdapter.
 *
 * Implementa o contrato do domínio delegando ao AzureDevOpsService.
 *
 * DIP: Recebe AzureDevOpsService via construtor — sem acesso direto ao banco.
 * LSP: Totalmente substituível por qualquer IProjectManagerAdapter.
 */

import { inject, injectable } from 'tsyringe';
import {
    IProjectManagerAdapter,
    ProjectManagerType,
    WebhookResult,
} from '../../../domain/project-manager/IProjectManagerAdapter';
import {
    ProjectManagerConfig,
    ProjectManagerMapping,
} from '../../../domain/project-manager/ProjectManagerIssue';
import { AzureDevOpsService } from './AzureDevOpsService';
import { TOKENS } from '../../../bootstrap/tokens';

@injectable()
export class AzureDevOpsAdapter implements IProjectManagerAdapter {
    readonly type: ProjectManagerType = 'azure-devops';

    constructor(
        @inject(TOKENS.AzureDevOpsService) private readonly service: AzureDevOpsService,
    ) { }

    async validateCredentials(): Promise<boolean> {
        return this.service.validateStoredCredentials();
    }

    fetchConfig(): Promise<ProjectManagerConfig> {
        return this.service.fetchConfig();
    }

    getMapping(): Promise<ProjectManagerMapping | null> {
        return this.service.getMapping();
    }

    saveMapping(m: Omit<ProjectManagerMapping, 'savedAt'>): Promise<ProjectManagerMapping> {
        return this.service.saveMapping(m);
    }

    /**
     * Processa um webhook do Azure DevOps.
     *
     * O Azure DevOps não envia assinatura HMAC por padrão nas service hooks.
     * A validação de origem pode ser feita via IP allowlist ou shared secret
     * configurado na subscription (campo `httpHeaders`).
     *
     * Aceita dois formatos:
     *   1. Com metadados de request: `{ body, signature?, rawBody? }` — passado pelo controller
     *   2. Payload direto: o corpo do webhook sem metadados
     */
    processWebhook(payload: unknown): Promise<void> {
        const meta = payload as { body?: unknown; signature?: string; rawBody?: string };

        if (meta?.body !== undefined) {
            return this.service.processWebhook(meta.body);
        }

        return this.service.processWebhook(payload);
    }

    createWebhook(url: string): Promise<WebhookResult> {
        return this.service.createWebhook(url);
    }

    addLabel(issueKey: string, label: string): Promise<void> {
        return this.service.addLabel(issueKey, label);
    }

    addComment(issueKey: string, body: string): Promise<void> {
        return this.service.addComment(issueKey, body);
    }

    updateTaskStatus(issueKey: string, statusName: string): Promise<void> {
        return this.service.updateTaskStatus(issueKey, statusName);
    }
}
