import { Router } from 'express';
import { runQuery, executeQuery } from '../config/db';
import { JiraService } from '../services/JiraService';
import { repoManager } from '../services/RepoManager';
import { taskQueue } from '../workers/TaskWorker';

// Lazy import to avoid circular dependency — ngrokPublicUrl is set after server starts
const getNgrokUrl = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ngrokPublicUrl } = require('../index');
  return ngrokPublicUrl as string | null;
};

const router = Router();
const jiraService = new JiraService();

// Get settings
router.get('/settings', async (req, res) => {
  try {
    const rows = await runQuery('SELECT * FROM settings');
    const settings = rows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Save settings
router.post('/settings', async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await executeQuery(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
        [key, value]
      );
    }

    // Trigger repo synchronization in the background
    if (settings.repo_mappings) {
      try {
        const mappings = JSON.parse(settings.repo_mappings);
        repoManager.syncRepositories(mappings, settings.git_pat || '');
      } catch (e) {
        console.error('Failed to parse repo_mappings for sync:', e);
      }
    }

    // Validate Jira credentials and return result
    let jiraValid: boolean | null = null;
    if (settings.jira_url || settings.jira_email || settings.jira_token) {
      jiraValid = await jiraService.validateCredentials(
        settings.jira_url || '',
        settings.jira_email || '',
        settings.jira_token || ''
      );
    }

    res.json({ success: true, jiraValid });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get repository clone status
router.get('/repos/status', (req, res) => {
  res.json(repoManager.getStatusMap());
});

// Jira webhook URL validation (Jira sends GET to verify the endpoint is reachable)
router.get('/jira/webhook', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Jira webhook endpoint is active.' });
});

// Webhook endpoint for Jira (receives actual events)
router.post('/jira/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Jira webhook payload:', payload?.webhookEvent);
    
    // Process the transition event
    await jiraService.processWebhook(payload);
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Get tasks for dashboard
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await runQuery('SELECT * FROM tasks ORDER BY updated_at DESC');
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Delete a task — removes from DB and cancels the BullMQ job if still queued
router.delete('/tasks/:id', async (req, res) => {
  const taskId = req.params.id;
  try {
    // Try to remove the job from BullMQ queue (no-op if already processed)
    const job = await taskQueue.getJob(taskId);
    if (job) {
      await job.remove();
      console.log(`[API] Removed job ${taskId} from queue.`);
    }

    // Remove from database
    await executeQuery('DELETE FROM tasks WHERE id = ?', [taskId]);

    res.json({ success: true, id: taskId });
  } catch (error) {
    console.error(`[API] Error deleting task ${taskId}:`, error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Retry a task — resets status and re-enqueues the job
router.post('/tasks/:id/retry', async (req, res) => {
  const taskId = req.params.id;
  try {
    const rows = await runQuery('SELECT * FROM tasks WHERE id = ?', [taskId]) as any[];
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Task not found.' });
    }
    const task = rows[0];

    // Check if job is currently active (being processed by a worker)
    const existing = await taskQueue.getJob(taskId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active') {
        // Job is running — can't remove a locked job, inform the caller
        return res.status(409).json({
          success: false,
          error: 'A tarefa está sendo processada no momento. Aguarde a conclusão ou o erro antes de reprocessar.',
          state,
        });
      }
      // Not active — safe to remove
      try {
        await existing.remove();
      } catch (e) {
        console.warn(`[API] Could not remove job ${taskId} (may have just completed):`, e);
      }
    }

    // Reset DB status
    await executeQuery(
      `UPDATE tasks SET status = 'em fila', logs = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [taskId]
    );

    // Re-enqueue
    await taskQueue.add('agent-task', {
      taskId: task.id,
      parentId: task.parent_id,
      parentTitle: '',
      parentDescription: '',
      repository: task.repository,
      title: task.id,
      description: '',
      branch: task.branch,
    }, {
      jobId: taskId,
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log(`[API] Task ${taskId} requeued for retry.`);
    res.json({ success: true, id: taskId });
  } catch (error) {
    console.error(`[API] Error retrying task ${taskId}:`, error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Returns the active ngrok public URL (if any)
router.get('/ngrok-url', (req, res) => {
  const url = getNgrokUrl();
  res.json({ url: url ?? null, webhookUrl: url ? `${url}/api/jira/webhook` : null });
});

// Automatically register webhook in Jira using the active ngrok URL
router.post('/jira/setup-webhook', async (req, res) => {
  try {
    // Allow caller to override the URL (e.g. custom domain)
    let webhookUrl: string = req.body?.webhookUrl;

    if (!webhookUrl) {
      const ngrokUrl = getNgrokUrl();
      if (!ngrokUrl) {
        return res.status(400).json({ success: false, error: 'Ngrok tunnel is not active. Start the server with NGROK_AUTHTOKEN set, or provide a webhookUrl in the request body.' });
      }
      webhookUrl = `${ngrokUrl}/api/jira/webhook`;
    }

    console.log(`[API] Registering Jira webhook for URL: ${webhookUrl}`);
    const result = await jiraService.createWebhook(webhookUrl);

    if (result.success) {
      res.json({ success: true, webhookUrl, id: result.id });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
