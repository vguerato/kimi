/**
 * AzureDevOpsService — Serviço de integração com o Azure DevOps Boards.
 *
 * Contém toda a lógica de integração em um único arquivo, seguindo o mesmo
 * padrão do JiraService:
 *   - AzureDevOpsClient: camada HTTP fina (autenticação via PAT)
 *   - AzureDevOpsService: orquestração (webhooks, mapping, feedback)
 *
 * ─── Autenticação ─────────────────────────────────────────────────────────────
 *
 *   Personal Access Token (PAT) via Basic Auth com username vazio:
 *     Authorization: Basic base64(":{PAT}")
 *
 * ─── Endpoints utilizados ─────────────────────────────────────────────────────
 *
 *   GET  /{org}/{project}/_apis/wit/workitemtypes?api-version=7.1
 *        Lista todos os tipos de work item do projeto
 *
 *   GET  /{org}/{project}/_apis/wit/workitemtypes/{type}/states?api-version=7.1
 *        Lista os estados de um tipo de work item
 *
 *   GET  /{org}/{project}/_apis/wit/workitems/{id}?$expand=relations&api-version=7.1
 *        Busca um work item com suas relações (para encontrar o pai)
 *
 *   PATCH /{org}/{project}/_apis/wit/workitems/{id}?api-version=7.1
 *        Atualiza campos de um work item (estado, tags, comentário)
 *        Content-Type: application/json-patch+json
 *
 *   POST  /{org}/_apis/hooks/subscriptions?api-version=7.1
 *        Cria uma service hook subscription para workitem.updated
 *
 *   GET   /{org}/_apis/hooks/subscriptions?api-version=7.1
 *        Lista subscriptions existentes
 *
 * ─── Convenção de repositório ─────────────────────────────────────────────────
 *
 *   O título do work item deve conter o prefixo do repositório entre colchetes:
 *     "[repo-prefix] Título da tarefa"
 *   Exemplo: "[payments] Adicionar endpoint de reembolso"
 *
 * ─── Webhook payload (workitem.updated) ──────────────────────────────────────
 *
 *   O Azure DevOps envia um payload com a estrutura:
 *   {
 *     "eventType": "workitem.updated",
 *     "resource": {
 *       "id": 123,                          // work item ID
 *       "workItemId": 123,
 *       "fields": {
 *         "System.State": { "oldValue": "Active", "newValue": "Resolved" },
 *         "System.Tags":  { "oldValue": "...",    "newValue": "..." }
 *       },
 *       "revision": {
 *         "id": 123,
 *         "fields": {
 *           "System.Title":        "...",
 *           "System.Description":  "...",
 *           "System.WorkItemType": "Task",
 *           "System.State":        "Resolved",
 *           "System.Tags":         "tag1; tag2",
 *           "System.TeamProject":  "MyProject"
 *         },
 *         "relations": [...]
 *       }
 *     }
 *   }
 *
 * Dependências injetadas (DIP):
 *   - ISettingsRepository: credenciais e mapping
 *   - ITaskRepository: persistência de tarefas
 *   - ITaskQueue: enfileiramento para o worker
 */

import axios, { AxiosInstance } from 'axios';
import { inject, injectable } from 'tsyringe';
import { logger } from '../../../config/logger';
import { ISettingsRepository } from '../../../domain/settings/ports/ISettingsRepository';
import { ITaskRepository } from '../../../domain/task/ports/ITaskRepository';
import { ITaskQueue } from '../../../domain/task/ports/ITaskQueue';
import { TaskId } from '../../../domain/task/value-objects/TaskId';
import { TaskStatus } from '../../../domain/task/value-objects/TaskStatus';
import { BranchName } from '../../../domain/task/value-objects/BranchName';
import { TaskAggregate } from '../../../domain/task/Task.aggregate';
import {
    ProjectManagerConfig,
    ProjectManagerMapping,
    ProjectManagerIssue,
} from '../../../domain/project-manager/ProjectManagerIssue';
import { ServiceUnavailableError } from '../../../api/errors/HttpError';
import { TOKENS } from '../../../bootstrap/tokens';

const log = logger.child({ module: 'azure-devops-service' });

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 1 — Credenciais e tipos da API
// ═══════════════════════════════════════════════════════════════════════════════

interface AzureDevOpsCredentials {
    readonly organization: string;
    readonly project: string;
    readonly token: string;
}

/** Campos relevantes de um work item retornado pela API. */
interface AzureWorkItemFields {
    'System.Title': string;
    'System.Description'?: string;
    'System.WorkItemType': string;
    'System.State': string;
    'System.Tags'?: string;
    'System.TeamProject': string;
    'System.Parent'?: number;
}

interface AzureWorkItem {
    id: number;
    fields: AzureWorkItemFields;
    relations?: Array<{
        rel: string;       // ex: "System.LinkTypes.Hierarchy-Reverse" = pai
        url: string;
        attributes?: { name?: string };
    }>;
}

/** Payload do evento workitem.updated enviado pelo Azure DevOps. */
export interface AzureDevOpsWebhookPayload {
    eventType: string;
    resource: {
        id: number;
        workItemId: number;
        /** Campos que mudaram nesta atualização, com oldValue/newValue. */
        fields?: Record<string, { oldValue?: unknown; newValue?: unknown }>;
        revision: {
            id: number;
            fields: AzureWorkItemFields;
            relations?: AzureWorkItem['relations'];
        };
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 2 — AzureDevOpsClient (camada HTTP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AzureDevOpsClient — Camada HTTP fina para a API REST do Azure DevOps.
 *
 * Autenticação: Basic Auth com PAT (Personal Access Token).
 * O username é vazio — o Azure DevOps aceita `:PAT` como credencial.
 */
class AzureDevOpsClient {
    private readonly http: AxiosInstance;
    private readonly baseUrl: string;

    constructor(private readonly creds: AzureDevOpsCredentials) {
        this.baseUrl = `https://dev.azure.com/${creds.organization}`;
        this.http = axios.create({
            baseURL: this.baseUrl,
            timeout: 15_000,
            headers: {
                // PAT via Basic Auth: username vazio, password = token
                Authorization: `Basic ${Buffer.from(`:${creds.token}`).toString('base64')}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }

    private get<T = unknown>(path: string) { return this.http.get<T>(path); }
    private post<T = unknown>(path: string, data: unknown) { return this.http.post<T>(path, data); }

    /** PATCH com Content-Type application/json-patch+json (obrigatório para work items). */
    private patch<T = unknown>(path: string, data: unknown) {
        return this.http.patch<T>(path, data, {
            headers: { 'Content-Type': 'application/json-patch+json' },
        });
    }

    /** Valida as credenciais tentando listar os projetos da organização. */
    async validateCredentials(): Promise<boolean> {
        try {
            const { status } = await this.get(`/_apis/projects?api-version=7.1`);
            return status === 200;
        } catch {
            return false;
        }
    }

    /**
     * Lista todos os tipos de work item do projeto.
     * Retorna nome, descrição e se é um tipo de "tarefa folha" (sem filhos).
     */
    async getWorkItemTypes(): Promise<Array<{ name: string; description: string }>> {
        const { data } = await this.get<{ value: Array<{ name: string; description: string }> }>(
            `/${this.creds.project}/_apis/wit/workitemtypes?api-version=7.1`,
        );
        return data.value ?? [];
    }

    /**
     * Lista os estados de um tipo de work item específico.
     * Inclui a categoria do estado (Proposed, InProgress, Resolved, Completed).
     */
    async getWorkItemTypeStates(typeName: string): Promise<Array<{ name: string; stateCategory: string }>> {
        const encoded = encodeURIComponent(typeName);
        const { data } = await this.get<{ value: Array<{ name: string; stateCategory: string }> }>(
            `/${this.creds.project}/_apis/wit/workitemtypes/${encoded}/states?api-version=7.1`,
        );
        return data.value ?? [];
    }

    /**
     * Busca um work item pelo ID, expandindo relações para encontrar o pai.
     */
    async getWorkItem(id: number): Promise<AzureWorkItem> {
        const { data } = await this.get<AzureWorkItem>(
            `/${this.creds.project}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`,
        );
        return data;
    }

    /**
     * Atualiza o estado de um work item via JSON Patch.
     * O Azure DevOps usa JSON Patch (RFC 6902) para atualizações de work items.
     */
    async updateState(id: number, state: string): Promise<void> {
        await this.patch(
            `/${this.creds.project}/_apis/wit/workitems/${id}?api-version=7.1`,
            [{ op: 'add', path: '/fields/System.State', value: state }],
        );
    }

    /**
     * Adiciona uma tag a um work item.
     * Tags no Azure DevOps são separadas por ponto-e-vírgula.
     * Busca as tags existentes e adiciona a nova sem duplicar.
     */
    async addTag(id: number, tag: string): Promise<void> {
        const item = await this.getWorkItem(id);
        const existing = (item.fields['System.Tags'] ?? '').split(';').map(t => t.trim()).filter(Boolean);
        if (existing.includes(tag)) return;

        const newTags = [...existing, tag].join('; ');
        await this.patch(
            `/${this.creds.project}/_apis/wit/workitems/${id}?api-version=7.1`,
            [{ op: 'add', path: '/fields/System.Tags', value: newTags }],
        );
    }

    /**
     * Adiciona um comentário a um work item via Discussion.
     */
    async addComment(id: number, text: string): Promise<void> {
        await this.post(
            `/${this.creds.project}/_apis/wit/workitems/${id}/comments?api-version=7.1-preview.3`,
            { text },
        );
    }

    /**
     * Lista as service hook subscriptions existentes.
     */
    async getSubscriptions(): Promise<Array<{ id: string; consumerInputs: { url?: string } }>> {
        const { data } = await this.get<{ value: Array<{ id: string; consumerInputs: { url?: string } }> }>(
            `/_apis/hooks/subscriptions?api-version=7.1`,
        );
        return data.value ?? [];
    }

    /**
     * Cria uma service hook subscription para o evento workitem.updated.
     *
     * O Azure DevOps envia um POST para webhookUrl sempre que um work item
     * for atualizado no projeto configurado.
     */
    async createSubscription(webhookUrl: string): Promise<{ id: string }> {
        const { data } = await this.post<{ id: string }>(
            `/_apis/hooks/subscriptions?api-version=7.1`,
            {
                publisherId: 'tfs',
                eventType: 'workitem.updated',
                resourceVersion: '1.0',
                consumerId: 'webHooks',
                consumerActionId: 'httpRequest',
                publisherInputs: {
                    projectId: this.creds.project,
                },
                consumerInputs: {
                    url: webhookUrl,
                    httpHeaders: '',
                    resourceDetailsToSend: 'all',
                    messagesToSend: 'none',
                    detailedMessagesToSend: 'none',
                },
            },
        );
        return data;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 3 — Helpers de mapeamento
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extrai o prefixo de repositório e o título limpo do título do work item.
 * Convenção: "[repo-prefix] Título da tarefa"
 */
function parseSummary(title: string): { prefix: string | null; cleanTitle: string } {
    const match = title.match(/^\[([^\]]+)\]\s*(.*)/);
    if (match) return { prefix: match[1].trim().toLowerCase(), cleanTitle: match[2].trim() };
    return { prefix: null, cleanTitle: title.trim() };
}

/**
 * Converte um work item do Azure DevOps para o tipo agnóstico de domínio.
 *
 * Descrição: o Azure DevOps retorna HTML em System.Description.
 * Fazemos uma limpeza básica de tags HTML para texto legível.
 */
function toProjectManagerIssue(
    item: AzureWorkItem,
    parentTask?: Pick<ProjectManagerIssue, 'id' | 'title' | 'description' | 'repository'>,
): ProjectManagerIssue {
    const title = item.fields['System.Title'] ?? '';
    const { prefix, cleanTitle } = parseSummary(title);
    const repository = prefix ?? parentTask?.repository ?? '';

    // Remove tags HTML básicas da descrição
    const rawDescription = item.fields['System.Description'] ?? '';
    const description = rawDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const issueId = String(item.id);
    const parentId = parentTask?.id ?? issueId;
    const branch = BranchName.fromParts(parentId, cleanTitle).value;

    return {
        id: issueId,
        type: (item.fields['System.WorkItemType'] ?? '').toLowerCase(),
        title: cleanTitle,
        description,
        repository,
        branch,
        parent: parentTask
            ? { id: parentTask.id, title: parentTask.title, description: parentTask.description }
            : undefined,
    };
}

/**
 * Extrai o ID do work item pai a partir das relações.
 * A relação "System.LinkTypes.Hierarchy-Reverse" indica o pai.
 */
function extractParentId(relations: AzureWorkItem['relations']): number | null {
    if (!relations) return null;
    const parentRel = relations.find(r => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
    if (!parentRel) return null;

    // URL format: https://dev.azure.com/{org}/{project}/_apis/wit/workitems/{id}
    const match = parentRel.url.match(/\/workitems\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 4 — AzureDevOpsService (orquestração)
// ═══════════════════════════════════════════════════════════════════════════════

@injectable()
export class AzureDevOpsService {
    constructor(
        @inject(TOKENS.SettingsRepository) private readonly settingsRepo: ISettingsRepository,
        @inject(TOKENS.TaskRepository) private readonly taskRepo: ITaskRepository,
        @inject(TOKENS.TaskQueue) private readonly taskQueue: ITaskQueue,
    ) { }

    // ─── Credenciais ─────────────────────────────────────────────────────────────

    private async loadCredentials(): Promise<AzureDevOpsCredentials | null> {
        const settings = await this.settingsRepo.findAll();
        const { azure_devops_org, azure_devops_project, azure_devops_token } = settings;
        if (!azure_devops_org || !azure_devops_project || !azure_devops_token) return null;
        return { organization: azure_devops_org, project: azure_devops_project, token: azure_devops_token };
    }

    private async requireClient(): Promise<AzureDevOpsClient> {
        const creds = await this.loadCredentials();
        if (!creds) throw new ServiceUnavailableError('Credenciais do Azure DevOps não configuradas.');
        return new AzureDevOpsClient(creds);
    }

    async validateStoredCredentials(): Promise<boolean> {
        const creds = await this.loadCredentials();
        if (!creds) return false;
        return new AzureDevOpsClient(creds).validateCredentials();
    }

    // ─── Configuração ─────────────────────────────────────────────────────────────

    /**
     * Busca todos os tipos de work item e seus estados para configuração do mapping.
     *
     * Estratégia: busca os tipos primeiro, depois os estados de cada tipo em paralelo.
     * Os estados são deduplicados por nome — projetos com múltiplos tipos podem ter
     * estados com o mesmo nome (ex: "Active" em Task e Bug).
     */
    async fetchConfig(): Promise<ProjectManagerConfig> {
        const client = await this.requireClient();
        const types = await client.getWorkItemTypes();

        // Busca estados de todos os tipos em paralelo
        const stateResults = await Promise.allSettled(
            types.map(t => client.getWorkItemTypeStates(t.name)),
        );

        // Deduplica estados por nome
        const stateMap = new Map<string, string>();
        stateResults.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                result.value.forEach(s => {
                    if (!stateMap.has(s.name)) {
                        stateMap.set(s.name, s.stateCategory);
                    }
                });
            } else {
                log.warn({ type: types[i].name, err: result.reason?.message }, 'Falha ao buscar estados do tipo');
            }
        });

        return {
            statuses: Array.from(stateMap.entries()).map(([name, category]) => ({
                id: name,
                name,
                statusCategory: category,
            })),
            issueTypes: types.map(t => ({
                id: t.name,
                name: t.name,
                subtask: false, // Azure DevOps não tem conceito nativo de subtask
                description: t.description ?? '',
            })),
        };
    }

    // ─── Mapping ─────────────────────────────────────────────────────────────────

    async getMapping(): Promise<ProjectManagerMapping | null> {
        const raw = await this.settingsRepo.findOne('azure_devops_mapping');
        if (!raw) return null;
        try {
            return JSON.parse(raw) as ProjectManagerMapping;
        } catch (e: unknown) {
            log.error({ err: (e as Error)?.message }, 'azure_devops_mapping não é JSON válido');
            return null;
        }
    }

    async saveMapping(mapping: Omit<ProjectManagerMapping, 'savedAt'>): Promise<ProjectManagerMapping> {
        const full: ProjectManagerMapping = { ...mapping, savedAt: new Date().toISOString() };
        await this.settingsRepo.upsert('azure_devops_mapping', JSON.stringify(full));
        log.info({ triggers: full.triggerStatuses.length, delegatable: full.delegatableTypes.length }, 'Mapping Azure DevOps salvo');
        return full;
    }

    // ─── Webhook ─────────────────────────────────────────────────────────────────

    /**
     * Processa um payload de webhook recebido do Azure DevOps.
     *
     * Fluxo:
     *   1. Valida que é um evento workitem.updated
     *   2. Extrai o novo estado do campo System.State
     *   3. Verifica se o estado é um trigger configurado
     *   4. Busca o work item completo (com relações) para obter o pai
     *   5. Enfileira a tarefa se elegível
     */
    async processWebhook(payload: unknown): Promise<void> {
        const typed = payload as AzureDevOpsWebhookPayload;

        if (typed.eventType !== 'workitem.updated') {
            log.debug({ event: typed.eventType }, 'Evento ignorado');
            return;
        }

        const resource = typed.resource;
        if (!resource?.workItemId && !resource?.id) {
            log.warn('Webhook sem workItemId — ignorando');
            return;
        }

        const workItemId = resource.workItemId ?? resource.id;

        // Extrai o novo estado do changelog de campos
        const stateChange = resource.fields?.['System.State'];
        const newState = stateChange?.newValue
            ? String(stateChange.newValue).toLowerCase().trim()
            : resource.revision?.fields?.['System.State']?.toLowerCase().trim() ?? null;

        if (!newState) {
            log.warn({ workItemId }, 'Estado não determinado — ignorando');
            return;
        }

        log.info({ workItemId, state: newState }, 'Webhook Azure DevOps recebido');

        const [mapping, creds] = await Promise.all([this.getMapping(), this.loadCredentials()]);

        if (!mapping) { log.warn({ workItemId }, 'Sem mapping — ignorando'); return; }
        if (!creds) { log.error({ workItemId }, 'Sem credenciais — ignorando'); return; }

        if (!this.isTriggerStatus(newState, mapping.triggerStatuses)) {
            log.info({ workItemId, state: newState }, 'Estado não é trigger — ignorando');
            return;
        }

        const client = new AzureDevOpsClient(creds);

        // Busca o work item completo para ter relações e campos atualizados
        let workItem: AzureWorkItem;
        try {
            workItem = await client.getWorkItem(workItemId);
        } catch (e: unknown) {
            log.error({ workItemId, err: (e as Error)?.message }, 'Falha ao buscar work item');
            return;
        }

        const typeName = (workItem.fields['System.WorkItemType'] ?? '').toLowerCase();

        // Verifica se o tipo é delegável
        const isDelegatable = mapping.delegatableTypes.some(t =>
            typeName.includes(t.toLowerCase()) || t.toLowerCase().includes(typeName),
        );
        if (!isDelegatable) {
            log.info({ workItemId, type: typeName }, 'Tipo não delegável — ignorando');
            return;
        }

        // Verifica se o estado deve ser pulado
        if (this.isTriggerStatus(newState, mapping.skipStatuses)) {
            log.info({ workItemId, state: newState }, 'Estado na lista de skip — ignorando');
            return;
        }

        // Tenta encontrar o work item pai
        const parentId = extractParentId(workItem.relations);
        if (parentId) {
            try {
                const parentItem = await client.getWorkItem(parentId);
                const parentIssue = toProjectManagerIssue(parentItem);
                await this.enqueueTask(toProjectManagerIssue(workItem, parentIssue));
            } catch (e: unknown) {
                log.warn({ workItemId, parentId, err: (e as Error)?.message }, 'Falha ao buscar pai — usando contexto do filho');
                await this.enqueueTask(toProjectManagerIssue(workItem));
            }
        } else {
            await this.enqueueTask(toProjectManagerIssue(workItem));
        }
    }

    private isTriggerStatus(status: string, triggers: string[]): boolean {
        const n = status.toLowerCase().trim();
        return triggers.some(t => {
            const tl = t.toLowerCase().trim();
            return tl === n || n.includes(tl) || tl.includes(n);
        });
    }

    // ─── Enfileiramento ───────────────────────────────────────────────────────────

    private async enqueueTask(issue: ProjectManagerIssue): Promise<void> {
        if (!issue.repository) {
            log.info({ issue: issue.id }, 'Ignorado — sem prefixo [repo] no título');
            return;
        }

        const taskId = TaskId.create(issue.id);
        const existing = await this.taskRepo.findById(taskId);

        if (existing && !existing.status.isFailed()) {
            log.info({ issue: issue.id, status: existing.status.value }, 'Já rastreado — ignorando');
            return;
        }

        if (existing) {
            existing.queue();
            existing.updateDetails(issue.title, issue.description);
            await this.taskRepo.update(existing);
        } else {
            await this.taskRepo.save(TaskAggregate.create({
                id: TaskId.create(issue.id),
                parentId: TaskId.create(issue.parent?.id ?? issue.id),
                title: issue.title,
                description: issue.description,
                repository: issue.repository,
                branch: BranchName.fromRaw(issue.branch),
                status: TaskStatus.queued(),
            }));
        }

        await this.taskQueue.enqueue({
            taskId: issue.id,
            parentId: issue.parent?.id ?? issue.id,
            parentTitle: issue.parent?.title ?? issue.title,
            parentDescription: issue.parent?.description ?? issue.description,
            repository: issue.repository,
            title: issue.title,
            description: issue.description,
            branch: issue.branch,
        });

        log.info({ issue: issue.id, repo: issue.repository, branch: issue.branch }, 'Tarefa Azure DevOps enfileirada');
    }

    // ─── Webhook management ───────────────────────────────────────────────────────

    /**
     * Cria uma service hook subscription no Azure DevOps.
     *
     * Verifica se já existe uma subscription para a mesma URL antes de criar.
     * O Azure DevOps não tem endpoint de "list webhooks" simples — usa o
     * endpoint de subscriptions do service hooks.
     */
    async createWebhook(webhookUrl: string): Promise<{ success: boolean; id?: number | string; error?: string }> {
        try {
            const client = await this.requireClient();

            // Verifica se já existe subscription para esta URL
            const existing = await client.getSubscriptions();
            const duplicate = existing.find(s => s.consumerInputs?.url === webhookUrl);
            if (duplicate) {
                log.info({ id: duplicate.id }, 'Subscription Azure DevOps já existe');
                return { success: true, id: duplicate.id };
            }

            const created = await client.createSubscription(webhookUrl);
            log.info({ id: created.id }, 'Subscription Azure DevOps criada');
            return { success: true, id: created.id };
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } }; message?: string })
                ?.response?.data?.message ?? (e as Error)?.message ?? 'Erro desconhecido';
            log.error({ err: msg }, 'Falha ao criar subscription Azure DevOps');
            return { success: false, error: String(msg) };
        }
    }

    // ─── Feedback no Azure DevOps ─────────────────────────────────────────────────

    /**
     * Adiciona uma tag ao work item.
     *
     * No Azure DevOps, "labels" são chamadas de "tags" e são separadas por
     * ponto-e-vírgula. O método adiciona a tag sem duplicar as existentes.
     */
    async addLabel(workItemId: string, tag: string): Promise<void> {
        try {
            const client = await this.requireClient();
            await client.addTag(parseInt(workItemId, 10), tag);
            log.info({ workItemId, tag }, 'Tag adicionada ao work item');
        } catch (e: unknown) {
            log.error({ workItemId, err: (e as Error)?.message }, 'addLabel (tag) falhou');
        }
    }

    /**
     * Adiciona um comentário ao work item via Discussion API.
     */
    async addComment(workItemId: string, text: string): Promise<void> {
        try {
            const client = await this.requireClient();
            await client.addComment(parseInt(workItemId, 10), text);
            log.info({ workItemId }, 'Comentário adicionado ao work item');
        } catch (e: unknown) {
            log.error({ workItemId, err: (e as Error)?.message }, 'addComment falhou');
        }
    }

    /**
     * Atualiza o estado (System.State) de um work item.
     *
     * O estado deve ser um dos estados válidos para o tipo do work item.
     * Se o estado não existir, o Azure DevOps retorna 400.
     */
    async updateTaskStatus(workItemId: string, stateName: string): Promise<void> {
        try {
            const client = await this.requireClient();
            await client.updateState(parseInt(workItemId, 10), stateName);
            log.info({ workItemId, state: stateName }, 'Estado do work item atualizado');
        } catch (e: unknown) {
            log.error({ workItemId, state: stateName, err: (e as Error)?.message }, 'updateTaskStatus falhou');
        }
    }
}
