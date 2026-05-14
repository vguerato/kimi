import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ngrok from '@ngrok/ngrok';
import { dbInit } from './config/db';
import apiRoutes from './routes/api';
import { taskWorker, requeuePendingTasks } from './workers/TaskWorker';
import { repoManager } from './services/RepoManager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Exposes the active ngrok public URL to the rest of the app
export let ngrokPublicUrl: string | null = null;

async function startNgrok(port: number | string) {
  const authtoken = process.env.NGROK_AUTHTOKEN;
  if (!authtoken) {
    console.log('[Ngrok] NGROK_AUTHTOKEN not set — skipping tunnel.');
    return;
  }

  try {
    const listener = await ngrok.forward({ addr: port, authtoken });
    ngrokPublicUrl = listener.url();
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║               NGROK TUNNEL ACTIVE                    ║');
    console.log(`║  Public URL : ${ngrokPublicUrl}`);
    console.log(`║  Webhook    : ${ngrokPublicUrl}/api/jira/webhook`);
    console.log('╚═══════════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('[Ngrok] Failed to start tunnel:', err);
  }
}

async function bootstrap() {
  try {
    await dbInit();

    // Sync repositories from saved settings on startup
    console.log('[Bootstrap] Running repository startup sync...');
    await repoManager.bootstrapFromDb();

    // Re-enqueue tasks that were left pending from a previous run
    console.log('[Bootstrap] Checking for pending tasks to requeue...');
    await requeuePendingTasks();

    app.listen(PORT, async () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
      console.log(`[Worker] Task worker active — listening on queue "agent-tasks" (worker id: ${taskWorker.id})`);
      await startNgrok(PORT);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
