/**
 * JiraService — Serviço de integração com o Jira.
 *
 * Contém toda a lógica de integração com o Jira em um único arquivo:
 *   - JiraClient: camada HTTP fina (tipos + requisições autenticadas)
 *   - adfToPlainText: conversor ADF → texto legível pelo agente
 *   - JiraService: orquestração (webhooks, mapping, feedback)
 *
 * Por que tudo em um arquivo?
 *   JiraClient e adfToPlainText são detalhes de implementação do JiraService.
 *   Não fazem sentido fora deste contexto e não precisam ser testados
 *   independentemente. Manter tudo junto reduz a fragmentação desnecessária.
 *
 * Dependências injetadas (DIP):
 *   - ISettingsRepository: credenciais e mapping
 *   - ITaskRepository: persistência de tarefas
 *   - ITaskQueue: enfileiramento para o worker
 */

import crypto from 'crypto';
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
import { TOKENS } from '../../../bootstrap/tokens';

const log = logger.child({ module: 'jira-service' });

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 1 — Tipos da API do Jira
// ═══════════════════════════════════════════════════════════════════════════════

interface JiraCredentials {
  readonly url: string;
  readonly email: string;
  readonly token: string;
}

/** Nó de um documento ADF (Atlassian Document Format). */
interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
}

interface JiraIssueFields {
  summary: string;
  description: AdfNode | string | null;
  status: { name: string; id: string };
  issuetype: { name: string; id: string; subtask: boolean };
  subtasks?: Array<{ key: string }>;
  labels?: string[];
  parent?: { key: string };
}

interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

interface JiraTransition {
  id: string;
  name: string;
  to: { name: string; id: string };
}

export interface JiraWebhookPayload {
  webhookEvent: string;
  issue: JiraIssue;
  changelog?: {
    items: Array<{
      field: string;
      fieldtype: string;
      from: string | null;
      fromString: string | null;
      to: string | null;
      toString: string | null;
    }>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 2 — Conversor ADF → texto plano
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Converte um documento ADF (Atlassian Document Format) para texto plano.
 *
 * O Jira retorna `description` como uma árvore ADF — o agente precisa de
 * texto legível, não de JSON serializado.
 *
 * Suporta os tipos mais comuns. Nós desconhecidos são processados recursivamente
 * para não perder conteúdo de texto aninhado.
 */
function adfToPlainText(node: AdfNode | string | null | undefined): string {
  if (!node) return '';
  if (typeof node === 'string') return node;

  switch (node.type) {
    case 'doc':
    case 'blockquote':
      return (node.content ?? []).map(adfToPlainText).join('\n').trim();

    case 'paragraph':
      return (node.content ?? []).map(adfToPlainText).join('') + '\n';

    case 'text':
      return node.text ?? '';

    case 'hardBreak':
      return '\n';

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      return '#'.repeat(level) + ' ' + (node.content ?? []).map(adfToPlainText).join('') + '\n';
    }

    case 'bulletList':
    case 'orderedList':
      return (node.content ?? []).map(adfToPlainText).join('');

    case 'listItem':
      return '- ' + (node.content ?? []).map(adfToPlainText).join('').trim() + '\n';

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      const code = (node.content ?? []).map(adfToPlainText).join('');
      return `\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }

    case 'inlineCode':
    case 'code':
      return '`' + (node.content ?? []).map(adfToPlainText).join('') + '`';

    case 'rule':
      return '---\n';

    case 'mention':
      return `@${(node.attrs?.text as string) ?? (node.attrs?.id as string) ?? 'user'}`;

    case 'emoji':
      return (node.attrs?.text as string) ?? '';

    case 'link':
    case 'inlineCard':
      return (node.attrs?.href as string) ?? (node.attrs?.url as string) ?? '';

    default:
      return (node.content ?? []).map(adfToPlainText).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 3 — JiraClient (camada HTTP)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * JiraClient — Camada HTTP fina para a API REST do Jira.
 *
 * Responsabilidade única: fazer requisições HTTP autenticadas.
 * Sem lógica de negócio, sem acesso ao banco, sem estado além das credenciais.
 */
class JiraClient {
  private readonly http: AxiosInstance;

  constructor(creds: JiraCredentials) {
    this.http = axios.create({
      baseURL: creds.url,
      timeout: 15_000,
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.email}:${creds.token}`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  private get<T = unknown>(path: string) { return this.http.get<T>(path); }
  private post<T = unknown>(path: string, data: unknown) { return this.http.post<T>(path, data); }
  private put<T = unknown>(path: string, data: unknown) { return this.http.put<T>(path, data); }

  async validateCredentials(): Promise<boolean> {
    try {
      const { status } = await this.get('/rest/api/2/myself');
      return status === 200;
    } catch {
      return false;
    }
  }

  async getIssue(key: string): Promise<JiraIssue> {
    const fields = 'summary,description,status,issuetype,subtasks,labels,assignee,parent';
    const { data } = await this.get<JiraIssue>(`/rest/api/2/issue/${key}?fields=${fields}`);
    return data;
  }

  async getStatuses(): Promise<Array<{ id: string; name: string; statusCategory: { name: string; key: string } }>> {
    const { data } = await this.get<unknown[]>('/rest/api/2/status');
    return (data ?? []) as never[];
  }

  async getIssueTypes(): Promise<Array<{ id: string; name: string; subtask: boolean; description: string }>> {
    const { data } = await this.get<unknown[]>('/rest/api/2/issuetype');
    return (data ?? []) as never[];
  }

  async getWebhooks(): Promise<Array<{ self: string; url: string }>> {
    const { data } = await this.get<unknown[]>('/rest/webhooks/1.0/webhook');
    return (data ?? []) as never[];
  }

  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const { data } = await this.get<{ transitions: JiraTransition[] }>(
      `/rest/api/2/issue/${issueKey}/transitions`,
    );
    return data.transitions ?? [];
  }

  async getLabels(issueKey: string): Promise<string[]> {
    const { data } = await this.get<{ fields: { labels: string[] } }>(
      `/rest/api/2/issue/${issueKey}?fields=labels`,
    );
    return data?.fields?.labels ?? [];
  }

  async setLabels(issueKey: string, labels: string[]): Promise<void> {
    await this.put(`/rest/api/2/issue/${issueKey}`, { fields: { labels } });
  }

  async addComment(issueKey: string, body: string): Promise<void> {
    await this.post(`/rest/api/2/issue/${issueKey}/comment`, { body });
  }

  async doTransition(issueKey: string, transitionId: string): Promise<void> {
    await this.post(`/rest/api/2/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
    });
  }

  async createWebhook(webhookUrl: string): Promise<{ self?: string; id?: string | number }> {
    const { data } = await this.post('/rest/webhooks/1.0/webhook', {
      name: 'Kiro AI — Task Delegator',
      url: webhookUrl,
      events: ['jira:issue_updated'],
      jqlFilter: '',
      excludeIssueDetails: false,
    });
    return data as { self?: string; id?: string | number };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 4 — Helpers de mapeamento
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extrai o prefixo de repositório e o título limpo de um summary do Jira.
 * Convenção: "[repo-prefix] Título da tarefa"
 */
function parseSummary(summary: string): { prefix: string | null; cleanTitle: string } {
  const match = summary.match(/^\[([^\]]+)\]\s*(.*)/);
  if (match) return { prefix: match[1].trim().toLowerCase(), cleanTitle: match[2].trim() };
  return { prefix: null, cleanTitle: summary.trim() };
}

/**
 * Converte um issue do Jira para o tipo agnóstico de domínio.
 * Converte a descrição ADF → texto plano.
 */
function toProjectManagerIssue(
  issue: JiraIssue,
  parentTask?: Pick<ProjectManagerIssue, 'id' | 'title' | 'description' | 'repository'>,
): ProjectManagerIssue {
  const summary = issue.fields?.summary ?? '';
  const { prefix, cleanTitle } = parseSummary(summary);
  const repository = prefix ?? parentTask?.repository ?? '';
  const description = adfToPlainText(issue.fields?.description ?? null);
  const parentId = parentTask?.id ?? issue.key;
  const branch = BranchName.fromParts(parentId, cleanTitle).value;

  return {
    id: issue.key,
    type: (issue.fields?.issuetype?.name ?? '').toLowerCase(),
    title: cleanTitle,
    description,
    repository,
    branch,
    parent: parentTask
      ? { id: parentTask.id, title: parentTask.title, description: parentTask.description }
      : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 5 — JiraService (orquestração)
// ═══════════════════════════════════════════════════════════════════════════════

@injectable()
export class JiraService {
  constructor(
    @inject(TOKENS.SettingsRepository) private readonly settingsRepo: ISettingsRepository,
    @inject(TOKENS.TaskRepository) private readonly taskRepo: ITaskRepository,
    @inject(TOKENS.TaskQueue) private readonly taskQueue: ITaskQueue,
  ) { }

  // ─── Credenciais ─────────────────────────────────────────────────────────────

  private async loadCredentials(): Promise<JiraCredentials | null> {
    const settings = await this.settingsRepo.findAll();
    const { jira_url, jira_email, jira_token } = settings;
    if (!jira_url || !jira_email || !jira_token) return null;
    return { url: jira_url, email: jira_email, token: jira_token };
  }

  private async requireClient(): Promise<JiraClient> {
    const creds = await this.loadCredentials();
    if (!creds) throw new Error('Credenciais do Jira não configuradas.');
    return new JiraClient(creds);
  }

  async validateStoredCredentials(): Promise<boolean> {
    const creds = await this.loadCredentials();
    if (!creds) return false;
    return new JiraClient(creds).validateCredentials();
  }

  async validateCredentials(url: string, email: string, token: string): Promise<boolean> {
    if (!url || !email || !token) return false;
    try {
      return new JiraClient({ url, email, token }).validateCredentials();
    } catch (e: unknown) {
      log.warn({ err: (e as Error)?.message }, 'Validação de credenciais falhou');
      return false;
    }
  }

  // ─── Configuração ─────────────────────────────────────────────────────────────

  async fetchJiraConfig(): Promise<ProjectManagerConfig> {
    const client = await this.requireClient();
    const [rawStatuses, rawTypes] = await Promise.all([
      client.getStatuses(),
      client.getIssueTypes(),
    ]);

    return {
      statuses: rawStatuses.map(s => ({
        id: String(s.id),
        name: String(s.name),
        statusCategory: String(s.statusCategory?.name ?? s.statusCategory?.key ?? ''),
      })),
      issueTypes: rawTypes.map(t => ({
        id: String(t.id),
        name: String(t.name),
        subtask: Boolean(t.subtask),
        description: String(t.description ?? ''),
      })),
    };
  }

  // ─── Mapping ─────────────────────────────────────────────────────────────────

  async getMapping(): Promise<ProjectManagerMapping | null> {
    const raw = await this.settingsRepo.findOne('jira_mapping');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ProjectManagerMapping;
    } catch (e: unknown) {
      log.error({ err: (e as Error)?.message }, 'jira_mapping não é JSON válido');
      return null;
    }
  }

  async saveMapping(mapping: Omit<ProjectManagerMapping, 'savedAt'>): Promise<ProjectManagerMapping> {
    const full: ProjectManagerMapping = { ...mapping, savedAt: new Date().toISOString() };
    await this.settingsRepo.upsert('jira_mapping', JSON.stringify(full));
    log.info({ triggers: full.triggerStatuses.length, delegatable: full.delegatableTypes.length }, 'Mapping salvo');
    return full;
  }

  // ─── Webhook ─────────────────────────────────────────────────────────────────

  async processWebhook(payload: unknown, signature?: string, rawBody?: string): Promise<void> {
    if (signature && rawBody) {
      const isValid = await this.validateWebhookSignature(signature, rawBody);
      if (!isValid) {
        log.warn('Webhook rejeitado: assinatura HMAC inválida');
        throw new Error('Assinatura do webhook inválida.');
      }
    }

    const typed = payload as JiraWebhookPayload;

    if (typed.webhookEvent !== 'jira:issue_updated') {
      log.debug({ event: typed.webhookEvent }, 'Evento ignorado');
      return;
    }

    const issue = typed.issue;
    if (!issue?.key) {
      log.warn('Webhook sem issue.key — ignorando');
      return;
    }

    const newStatus = this.extractNewStatus(typed);
    if (!newStatus) {
      log.warn({ issue: issue.key }, 'Status não determinado — ignorando');
      return;
    }

    log.info({ issue: issue.key, status: newStatus }, 'Webhook recebido');

    const [mapping, creds] = await Promise.all([this.getMapping(), this.loadCredentials()]);

    if (!mapping) { log.warn({ issue: issue.key }, 'Sem mapping — ignorando'); return; }
    if (!creds) { log.error({ issue: issue.key }, 'Sem credenciais — ignorando'); return; }

    if (!this.isTriggerStatus(newStatus, mapping.triggerStatuses)) {
      log.info({ issue: issue.key, status: newStatus }, 'Status não é trigger — ignorando');
      return;
    }

    const client = new JiraClient(creds);
    const subtaskRefs = issue.fields?.subtasks ?? [];

    if (subtaskRefs.length > 0) {
      const parentIssue = toProjectManagerIssue(issue);
      if (!parentIssue.repository) {
        log.warn({ issue: issue.key }, 'Issue pai sem prefixo [repo] — subtasks não processadas');
        return;
      }
      await this.handleParentWithSubtasks(subtaskRefs, parentIssue, client, mapping);
      return;
    }

    const parentRef = issue.fields?.parent;
    if (parentRef?.key) {
      log.info({ issue: issue.key, parent: parentRef.key }, 'Subtask direta — buscando pai');
      try {
        const parentIssue = await client.getIssue(parentRef.key);
        const parentTask = toProjectManagerIssue(parentIssue);
        await this.enqueueTask(toProjectManagerIssue(issue, parentTask));
      } catch (e: unknown) {
        log.error({ issue: issue.key, err: (e as Error)?.message }, 'Falha ao buscar pai — usando contexto do filho');
        await this.enqueueTask(toProjectManagerIssue(issue));
      }
      return;
    }

    await this.enqueueTask(toProjectManagerIssue(issue));
  }

  private extractNewStatus(payload: JiraWebhookPayload): string | null {
    const statusChange = (payload.changelog?.items ?? []).find(i => i.field === 'status');
    if (statusChange?.toString) return statusChange.toString.toLowerCase().trim();
    return payload.issue?.fields?.status?.name?.toLowerCase().trim() ?? null;
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
      log.info({ issue: issue.id }, 'Ignorado — sem prefixo [repo]');
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

    log.info({ issue: issue.id, repo: issue.repository, branch: issue.branch }, 'Tarefa enfileirada');
  }

  private async handleParentWithSubtasks(
    subtaskRefs: Array<{ key: string }>,
    parentTask: ProjectManagerIssue,
    client: JiraClient,
    mapping: ProjectManagerMapping,
  ): Promise<void> {
    log.info({ issue: parentTask.id, count: subtaskRefs.length }, 'Processando subtasks');

    const [fetchedResults, existingTasks] = await Promise.all([
      Promise.allSettled(subtaskRefs.map(st => client.getIssue(st.key))),
      Promise.all(subtaskRefs.map(st =>
        this.taskRepo.findById(TaskId.create(st.key)).catch(() => null),
      )),
    ]);

    const existingMap = new Map(
      existingTasks
        .filter((t): t is TaskAggregate => t !== null)
        .map(t => [t.id.value, t]),
    );

    const results = await Promise.allSettled(
      fetchedResults.map((result, i) => {
        if (result.status === 'rejected') {
          log.error({ issue: subtaskRefs[i].key, err: result.reason?.message }, 'Falha ao buscar subtask');
          return Promise.resolve('fetch-error' as const);
        }
        return this.processSubtask(result.value, parentTask, mapping, existingMap);
      }),
    );

    const counts = results.reduce(
      (acc, r) => { acc[r.status === 'fulfilled' && r.value === 'enqueued' ? 'enqueued' : 'skipped']++; return acc; },
      { enqueued: 0, skipped: 0 },
    );

    log.info({ issue: parentTask.id, ...counts }, 'Subtasks processadas');
  }

  private async processSubtask(
    stData: JiraIssue,
    parentTask: ProjectManagerIssue,
    mapping: ProjectManagerMapping,
    existingMap: Map<string, TaskAggregate>,
  ): Promise<'enqueued' | string> {
    const typeName = (stData.fields?.issuetype?.name ?? '').toLowerCase();
    const statusName = (stData.fields?.status?.name ?? '').toLowerCase();

    const isDelegatable = mapping.delegatableTypes.some(t =>
      typeName.includes(t.toLowerCase()) || t.toLowerCase().includes(typeName),
    );
    if (!isDelegatable) return `type:${typeName}`;

    const shouldSkip = mapping.skipStatuses.some(s =>
      statusName.includes(s.toLowerCase()) || s.toLowerCase().includes(statusName),
    );
    if (shouldSkip) return `status:${statusName}`;

    const existing = existingMap.get(stData.key);
    if (existing && !existing.status.isFailed()) return `db:${existing.status.value}`;

    const task = toProjectManagerIssue(stData, parentTask);
    if (!task.repository) return 'no-repo';

    await this.enqueueTask(task);
    return 'enqueued';
  }

  // ─── Webhook management ───────────────────────────────────────────────────────

  async createWebhook(webhookUrl: string): Promise<{ success: boolean; id?: number | string; error?: string }> {
    try {
      const client = await this.requireClient();
      const existing = (await client.getWebhooks()).find(wh => wh.url === webhookUrl);
      if (existing) return { success: true, id: existing.self };

      const data = await client.createWebhook(webhookUrl);
      const id = data?.self ?? data?.id;
      log.info({ ref: id }, 'Webhook criado');
      return { success: true, id };
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (e as Error)?.message ?? 'Erro desconhecido';
      log.error({ err: msg }, 'Falha ao criar webhook');
      return { success: false, error: String(msg) };
    }
  }

  // ─── Feedback no Jira ─────────────────────────────────────────────────────────

  async addLabel(issueKey: string, label: string): Promise<void> {
    try {
      const client = await this.requireClient();
      const labels = await client.getLabels(issueKey);
      if (labels.includes(label)) return;
      await client.setLabels(issueKey, [...labels, label]);
      log.info({ issue: issueKey, label }, 'Label adicionada');
    } catch (e: unknown) {
      log.error({ issue: issueKey, err: (e as Error)?.message }, 'addLabel falhou');
    }
  }

  async addComment(issueKey: string, body: string): Promise<void> {
    try {
      const client = await this.requireClient();
      await client.addComment(issueKey, body);
      log.info({ issue: issueKey }, 'Comentário adicionado');
    } catch (e: unknown) {
      log.error({ issue: issueKey, err: (e as Error)?.message }, 'addComment falhou');
    }
  }

  async updateTaskStatus(issueKey: string, statusName: string): Promise<void> {
    try {
      const client = await this.requireClient();
      const transitions = await client.getTransitions(issueKey);
      const transition = transitions.find(t => t.name.toLowerCase() === statusName.toLowerCase());

      if (!transition) {
        log.warn({ issue: issueKey, status: statusName, available: transitions.map(t => t.name).join(', ') }, 'Transição não encontrada');
        return;
      }

      await client.doTransition(issueKey, transition.id);
      log.info({ issue: issueKey, status: statusName }, 'Status atualizado');
    } catch (e: unknown) {
      log.error({ issue: issueKey, err: (e as Error)?.message }, 'updateTaskStatus falhou');
    }
  }

  // ─── Validação HMAC ───────────────────────────────────────────────────────────

  private async validateWebhookSignature(signature: string, rawBody: string): Promise<boolean> {
    const secret = await this.settingsRepo.findOne('jira_webhook_secret');
    if (!secret) return true; // sem secret = modo desenvolvimento

    try {
      const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf-8').digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
