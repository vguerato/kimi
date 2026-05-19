/**
 * JiraAdapter — Adapter do Jira para a porta IProjectManagerAdapter.
 *
 * Implementa o contrato do domínio delegando ao JiraService.
 * Responsável por:
 *   - Adaptar a assinatura do webhook (extrai headers relevantes)
 *   - Traduzir entre o contrato do domínio e o JiraService
 *
 * DIP: Recebe JiraService via construtor — sem acesso direto ao banco.
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
import { JiraService } from './JiraService';
import { TOKENS } from '../../../bootstrap/tokens';

@injectable()
export class JiraAdapter implements IProjectManagerAdapter {
    readonly type: ProjectManagerType = 'jira';

    constructor(
        @inject(TOKENS.JiraService) private readonly service: JiraService,
    ) { }

    async validateCredentials(): Promise<boolean> {
        return this.service.validateStoredCredentials();
    }

    fetchConfig(): Promise<ProjectManagerConfig> {
        return this.service.fetchJiraConfig();
    }

    getMapping(): Promise<ProjectManagerMapping | null> {
        return this.service.getMapping();
    }

    saveMapping(m: Omit<ProjectManagerMapping, 'savedAt'>): Promise<ProjectManagerMapping> {
        return this.service.saveMapping(m);
    }

    /**
     * Processa um webhook do Jira.
     *
     * Aceita dois formatos de payload:
     *   1. Com metadados de request: `{ body, signature?, rawBody? }` — passado pelo controller
     *   2. Payload direto: o corpo do webhook sem metadados de assinatura
     *
     * O formato com metadados permite validação HMAC quando o secret está configurado.
     */
    processWebhook(payload: unknown): Promise<void> {
        const meta = payload as { body?: unknown; signature?: string; rawBody?: string };

        if (meta?.body !== undefined) {
            return this.service.processWebhook(meta.body, meta.signature, meta.rawBody);
        }

        return this.service.processWebhook(payload);
    }

    createWebhook(url: string): Promise<WebhookResult> {
        return this.service.createWebhook(url);
    }

    addLabel(key: string, label: string): Promise<void> {
        return this.service.addLabel(key, label);
    }

    addComment(key: string, body: string): Promise<void> {
        return this.service.addComment(key, body);
    }

    updateTaskStatus(key: string, status: string): Promise<void> {
        return this.service.updateTaskStatus(key, status);
    }
}
