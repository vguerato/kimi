/**
 * app.ts — Inicializador da aplicação.
 *
 * Centraliza toda a lógica de bootstrap em um único lugar, mantendo o
 * index.ts como um entry point mínimo (apenas chama `startApp()`).
 *
 * Sequência de inicialização:
 *   1. Banco de dados (TypeORM)
 *   2. Container de dependências (DI)
 *   3. Worker de tarefas (BullMQ)
 *   4. Reenfileiramento de tarefas pendentes
 *   5. Servidor HTTP (Express)
 *   6. Tunnel Ngrok (apenas em desenvolvimento, se configurado)
 *
 * Por que separar do index.ts?
 *   - index.ts deve ser o menor arquivo possível — apenas o ponto de entrada
 *   - app.ts pode ser importado em testes de integração sem iniciar o servidor
 *   - A sequência de bootstrap é testável e documentada em um único lugar
 */

import express from 'express';
import cors from 'cors';
import { dbInit } from '../config/database';
import { logger } from '../config/logger';
import apiRoutes from '../api/router';
import { errorHandler } from '../api/middleware/errorHandler';
import { initializeContainer, container } from './container';
import { createTaskWorker, requeuePendingTasks } from '../infrastructure/queue/TaskWorker';
import { NgrokService } from '../infrastructure/tunnel/NgrokService';
import { HealthController } from '../api/controllers/HealthController';
import { asyncHandler } from '../api/middleware/asyncHandler';

// ─── Express app ──────────────────────────────────────────────────────────────

export const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRoutes);

// Health check — rota simples fora do prefixo /api
const health = new HealthController();
app.get('/health', asyncHandler(health.check.bind(health)));

// Middleware de erros — deve ser o último middleware registrado
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Inicializa todos os serviços e inicia o servidor HTTP.
 *
 * Lança exceção se qualquer etapa crítica falhar — o processo deve ser
 * reiniciado pelo orquestrador (Docker, PM2, etc.).
 */
export async function startApp(): Promise<void> {
    const PORT = process.env.PORT ?? 3001;

    // 1. Banco de dados
    await dbInit();
    logger.info('Banco de dados inicializado');

    // 2. Container de dependências
    await initializeContainer();

    // 3. Worker de tarefas
    const worker = createTaskWorker(container.taskOrchestrator);
    logger.info({ workerId: worker.id }, 'Worker de tarefas ativo na fila "agent-tasks"');

    // 4. Reenfileira tarefas pendentes (recuperação após restart)
    logger.info('Verificando tarefas pendentes para reenfileirar...');
    await requeuePendingTasks();

    // 5. Servidor HTTP
    await new Promise<void>((resolve) => {
        app.listen(PORT, () => {
            logger.info({ port: PORT }, 'Servidor Kiro AI Backend v2 iniciado');
            resolve();
        });
    });

    // 6. Ngrok — apenas em desenvolvimento, se configurado
    const ngrokService = new NgrokService();
    await ngrokService.start(PORT);
}
