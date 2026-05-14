import { Worker, Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { executeQuery, runQuery } from '../config/db';
import { AgentService } from '../services/AgentService';
import { GitService } from '../services/GitService';
import { JiraService } from '../services/JiraService';
// Re-use connection for BullMQ
export const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const taskQueue = new Queue('agent-tasks', { connection });

/**
 * Re-enqueues tasks that were left in 'em fila' or 'error' status from a previous run.
 * Called once on server bootstrap to recover from crashes or restarts.
 */
export async function requeuePendingTasks(): Promise<void> {
  const pending = await runQuery(
    `SELECT t.id, t.parent_id, t.repository, t.branch, t.status
     FROM tasks t
     WHERE t.status IN ('em fila', 'error')
     ORDER BY t.updated_at ASC`
  );

  if (!pending || pending.length === 0) {
    console.log('[Bootstrap] No pending tasks to requeue.');
    return;
  }

  console.log(`[Bootstrap] Requeueing ${pending.length} pending task(s)...`);

  for (const task of pending as any[]) {
    try {
      // Fetch title/description from Jira settings are not stored locally,
      // so we enqueue with available data; the worker will use what it has.
      await taskQueue.add(
        'agent-task',
        {
          taskId: task.id,
          parentId: task.parent_id,
          repository: task.repository,
          title: task.id,          // Fallback — worker uses taskId if title is missing
          description: '',          // Worker will proceed; agent will use git context
          branch: task.branch,
        },
        {
          jobId: task.id,           // Idempotent — won't add duplicates if already queued
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      // Reset error status back to em fila so the dashboard shows correct state
      if (task.status === 'error') {
        await executeQuery(
          `UPDATE tasks SET status = 'em fila', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [task.id]
        );
      }

      console.log(`[Bootstrap] Requeued task ${task.id} (was: ${task.status})`);
    } catch (err) {
      console.error(`[Bootstrap] Failed to requeue task ${task.id}:`, err);
    }
  }

  console.log('[Bootstrap] Pending task requeue complete.');
}
export interface DelegateSubtaskData {
  taskId: string;
  parentId: string;
  repository: string;
  title: string;
  description: string;
  branch: string;
}

export const taskWorker = new Worker('agent-tasks', async (job: Job<DelegateSubtaskData>) => {
  const data = job.data;
  console.log(`[Worker] Started processing task ${data.taskId} for parent ${data.parentId}`);

  // Mark as processing immediately so the dashboard shows a spinner
  await executeQuery(
    `UPDATE tasks SET status = 'processando', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [data.taskId]
  );

  try {
    // 1. Fetch settings (PAT, Repo Directory)
    const settingsRows = await runQuery('SELECT * FROM settings');
    const settings = settingsRows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const gitPat = settings['git_pat'] || '';
    const githubUsername = settings['github_username'] || 'kiro-agent';
    
    // Parse repo mappings
    let repoMappings: Record<string, string> = {};
    try {
      if (settings['repo_mappings']) {
        repoMappings = JSON.parse(settings['repo_mappings']);
      }
    } catch (e) {
      console.error(`[Worker] Error parsing repo_mappings:`, e);
    }

    const repoUrl = repoMappings[data.repository];
    if (!repoUrl) {
      throw new Error(`No repository URL mapped for prefix: ${data.repository}`);
    }

    // 2. Git Synchronization and Branching
    const baseDir = '/app/repos'; 
    const gitService = new GitService(baseDir, data.repository, repoUrl, gitPat, githubUsername);
    await gitService.syncAndBranch(data.branch);

    // 3. Select the best model for this task via LLM prompt
    console.log(`[Worker] Selecting model for task ${data.taskId}...`);
    const selectedModel = await AgentService.selectModelForTask(data);
    console.log(`[Worker] Model selected: ${selectedModel}`);

    // Persist the chosen model in the DB so the dashboard can display it
    await executeQuery(
      `UPDATE tasks SET model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [selectedModel, data.taskId]
    );

    // Add a label to the Jira card indicating the selected model
    const jiraService = new JiraService();
    await jiraService.addLabel(data.taskId, `model:${selectedModel}`);

    // 4. Agent Execution using the selected model
    const agentService = new AgentService(gitService.getRepoPath(), data, selectedModel);
    await agentService.executeTask();

    // 5. Commit and push changes made by the agent
    console.log(`[Worker] Committing and pushing changes for task ${data.taskId}...`);
    await gitService.commit(data.taskId, data.title || data.taskId);
    await gitService.push(data.branch);

    // 6. Update task status in DB to "em espera"
    await executeQuery(
      `UPDATE tasks SET status = 'em espera', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [data.taskId]
    );

    // 7. Move the Jira subtask to "Em análise" (review column)
    console.log(`[Worker] Moving Jira issue ${data.taskId} to "Em análise"...`);
    await jiraService.updateTaskStatus(data.taskId, 'Em análise');

    console.log(`[Worker] Finished processing task ${data.taskId}`);

  } catch (error) {
    console.error(`[Worker] Error processing task ${data.taskId}:`, error);
    await executeQuery(`UPDATE tasks SET status = ?, logs = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, ['error', String(error), data.taskId]);
    throw error;
  }
}, { connection });
