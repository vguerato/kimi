import axios from 'axios';
import { runQuery, executeQuery } from '../config/db';
import { Queue } from 'bullmq';
import { connection } from '../workers/TaskWorker';

const taskQueue = new Queue('agent-tasks', { connection });

export class JiraService {
  private async getJiraConfig() {
    const rows = await runQuery("SELECT * FROM settings WHERE key IN ('jira_url', 'jira_email', 'jira_token')");
    const config: any = {};
    rows.forEach((row: any) => { config[row.key] = row.value; });
    return config;
  }

  private getAuthHeader(email: string, token: string) {
    return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  }

  async validateCredentials(jira_url: string, jira_email: string, jira_token: string): Promise<boolean> {
    if (!jira_url || !jira_email || !jira_token) return false;
    try {
      const response = await axios.get(`${jira_url}/rest/api/2/myself`, {
        headers: { Authorization: this.getAuthHeader(jira_email, jira_token) },
        timeout: 8000
      });
      return response.status === 200;
    } catch (e: any) {
      console.warn(`[JiraService] Credential validation failed: ${e?.response?.status || e?.message}`);
      return false;
    }
  }

  async createWebhook(webhookUrl: string): Promise<{ success: boolean; id?: number; error?: string }> {
    const config = await this.getJiraConfig();
    if (!config.jira_url || !config.jira_email || !config.jira_token) {
      return { success: false, error: 'Credenciais do Jira não configuradas.' };
    }

    const authHeader = this.getAuthHeader(config.jira_email, config.jira_token);

    try {
      // First check if a webhook with the same URL already exists to avoid duplicates
      const existingRes = await axios.get(`${config.jira_url}/rest/webhooks/1.0/webhook`, {
        headers: { Authorization: authHeader },
        timeout: 10000
      });

      const existing = existingRes.data?.find((wh: any) => wh.url === webhookUrl);
      if (existing) {
        console.log(`[JiraService] Webhook already exists with id ${existing.self}.`);
        return { success: true, id: existing.self };
      }
    } catch (e: any) {
      // Non-fatal — proceed to create
      console.warn('[JiraService] Could not list existing webhooks:', e?.response?.status || e?.message);
    }

    try {
      const response = await axios.post(
        `${config.jira_url}/rest/webhooks/1.0/webhook`,
        {
          name: 'Kiro AI — Task Delegator',
          url: webhookUrl,
          events: ['jira:issue_updated'],
          jqlFilter: '',
          excludeIssueDetails: false,
        },
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const id = response.data?.self || response.data?.id;
      console.log(`[JiraService] Webhook created successfully. Ref: ${id}`);
      return { success: true, id };
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data || e?.message || 'Unknown error';
      console.error('[JiraService] Failed to create webhook:', msg);
      return { success: false, error: String(msg) };
    }
  }

  // Status names that trigger delegation (case-insensitive match)
  private readonly TRIGGER_STATUSES = ['em desenvolvimento', 'em andamento', 'in progress', 'in development'];

  // Only issue types considered as real "sub-tasks" for delegation
  private readonly ALLOWED_SUBTASK_TYPES = ['sub-task', 'subtask', 'sub-tarefa'];

  async processWebhook(payload: any) {
    console.log('[JiraService] Raw webhook event:', payload?.webhookEvent);

    const { webhookEvent, issue, changelog } = payload;

    // We only handle issue update events
    if (webhookEvent !== 'jira:issue_updated') {
      console.log(`[JiraService] Ignoring event: ${webhookEvent}`);
      return;
    }

    // Determine the new status from changelog (most reliable) or from issue.fields.status
    let newStatusName: string | null = null;

    if (changelog?.items) {
      const statusChange = changelog.items.find((item: any) => item.field === 'status');
      if (statusChange) {
        newStatusName = statusChange.toString?.toLowerCase() || statusChange.toString?.toLowerCase();
        // Jira sends 'toString' for the human-readable name
        newStatusName = (statusChange.toString || statusChange.to || '').toLowerCase();
      }
    }

    // Fallback: check current status on the issue itself
    if (!newStatusName) {
      newStatusName = issue?.fields?.status?.name?.toLowerCase() || null;
    }

    if (!newStatusName) {
      console.log('[JiraService] Could not determine status from webhook payload.');
      return;
    }

    console.log(`[JiraService] Issue ${issue.key} transitioned to status: "${newStatusName}"`);

    const isTrigger = this.TRIGGER_STATUSES.some(s => newStatusName!.includes(s));
    if (!isTrigger) {
      console.log(`[JiraService] Status "${newStatusName}" does not trigger delegation. Skipping.`);
      return;
    }

    const summary = issue?.fields?.summary || '';

    // Parse prefix: [balance] task name
    const prefixMatch = summary.match(/^\[(.*?)\]/);
    if (!prefixMatch) {
      console.log(`[JiraService] Task ${issue.key} has no repository prefix. Skipping.`);
      return;
    }

    const repository = prefixMatch[1].trim().toLowerCase();
    const parentId = issue.key;
    const slugTitle = summary.replace(/\[.*?\]\s*/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 50);
    const branchName = `feature/${parentId}-${slugTitle}`;

    const config = await this.getJiraConfig();
    if (!config.jira_url || !config.jira_email || !config.jira_token) {
      console.error('[JiraService] Missing Jira credentials in settings. Configure them in the dashboard.');
      return;
    }

    // Fetch sub-tasks from the issue fields (shallow list)
    const subtaskRefs: any[] = issue?.fields?.subtasks || [];

    if (subtaskRefs.length === 0) {
      console.log(`[JiraService] No subtasks found for ${parentId}.`);
      return;
    }

    console.log(`[JiraService] Found ${subtaskRefs.length} subtask(s) for ${parentId}. Processing...`);

    const authHeader = this.getAuthHeader(config.jira_email, config.jira_token);

    for (const st of subtaskRefs) {
      try {
        // Fetch full subtask details to read type and description
        const { data: stData } = await axios.get(`${config.jira_url}/rest/api/2/issue/${st.key}`, {
          headers: { Authorization: authHeader },
          timeout: 10000
        });

        const issueTypeName: string = (stData.fields?.issuetype?.name || '').toLowerCase();

        // Whitelist: only delegate actual sub-tasks, skip sub-tests and other types
        const isSubTask = this.ALLOWED_SUBTASK_TYPES.some(t => issueTypeName.includes(t));
        if (!isSubTask) {
          console.log(`[JiraService] Skipping ${st.key} — issue type "${issueTypeName}" is not a delegatable sub-task.`);
          continue;
        }

        const stSummary: string = stData.fields?.summary || st.key;
        const stDescription: string = stData.fields?.description || '';

        // Upsert into our DB — avoid duplicating if webhook fires twice
        await executeQuery(
          `INSERT INTO tasks (id, parent_id, repository, branch, status)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET status = CASE WHEN status = 'error' THEN 'em fila' ELSE status END`,
          [st.key, parentId, repository, branchName, 'em fila']
        );

        // Enqueue to BullMQ
        await taskQueue.add('agent-task', {
          taskId: st.key,
          parentId,
          repository,
          title: stSummary,
          description: stDescription,
          branch: branchName
        }, {
          jobId: st.key, // Prevent duplicate jobs for the same subtask
          removeOnComplete: true,
          removeOnFail: false,
        });

        console.log(`[JiraService] Enqueued subtask ${st.key} ("${stSummary}") → repo: ${repository}, branch: ${branchName}`);
      } catch (err: any) {
        console.error(`[JiraService] Error processing subtask ${st.key}:`, err?.message || err);
      }
    }

    console.log(`[JiraService] Done processing subtasks for ${parentId}.`);
  }

  /**
   * Adds a label to a Jira issue without removing existing labels.
   */
  async addLabel(issueKey: string, label: string): Promise<void> {
    const config = await this.getJiraConfig();
    if (!config.jira_url || !config.jira_email || !config.jira_token) {
      console.warn('[JiraService] Missing Jira credentials — skipping addLabel.');
      return;
    }

    const authHeader = this.getAuthHeader(config.jira_email, config.jira_token);

    try {
      // Fetch current labels so we don't overwrite them
      const { data: issueData } = await axios.get(
        `${config.jira_url}/rest/api/2/issue/${issueKey}?fields=labels`,
        { headers: { Authorization: authHeader }, timeout: 10000 }
      );

      const existingLabels: string[] = issueData?.fields?.labels || [];

      // Avoid duplicate labels
      if (existingLabels.includes(label)) {
        console.log(`[JiraService] Label "${label}" already present on ${issueKey}.`);
        return;
      }

      const updatedLabels = [...existingLabels, label];

      await axios.put(
        `${config.jira_url}/rest/api/2/issue/${issueKey}`,
        { fields: { labels: updatedLabels } },
        {
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      console.log(`[JiraService] Added label "${label}" to issue ${issueKey}.`);
    } catch (err: any) {
      console.error(`[JiraService] Failed to add label to ${issueKey}:`, err?.response?.data || err?.message);
    }
  }

  async updateTaskStatus(issueKey: string, statusName: string) {    const config = await this.getJiraConfig();
    if (!config.jira_url || !config.jira_email || !config.jira_token) return;

    // First we need to get the transition ID for the statusName
    const transitionsUrl = `${config.jira_url}/rest/api/2/issue/${issueKey}/transitions`;
    const response = await axios.get(transitionsUrl, {
      headers: { Authorization: this.getAuthHeader(config.jira_email, config.jira_token) }
    });

    const transition = response.data.transitions.find((t: any) => t.name.toLowerCase() === statusName.toLowerCase());
    if (transition) {
      await axios.post(transitionsUrl, {
        transition: { id: transition.id }
      }, {
        headers: { Authorization: this.getAuthHeader(config.jira_email, config.jira_token) }
      });
      console.log(`[JiraService] Updated Jira task ${issueKey} to ${statusName}`);
    } else {
      console.error(`[JiraService] Could not find transition for status ${statusName} on issue ${issueKey}`);
    }
  }
}
