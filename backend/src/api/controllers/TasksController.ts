/**
 * TasksController — Endpoints de gerenciamento de tarefas.
 *
 * Rotas:
 *   GET  /tasks                    → lista todas as tarefas
 *   GET  /tasks/:id/logs/stream    → stream SSE de logs em tempo real
 *   DELETE /tasks/:id              → remove tarefa
 *   POST /tasks/:id/retry          → reenfileira para reprocessamento
 */

import { Request, Response } from 'express';
import { ListTasksUseCase } from '../../application/tasks/ListTasksUseCase';
import { DeleteTaskUseCase } from '../../application/tasks/DeleteTaskUseCase';
import { RetryTaskUseCase } from '../../application/tasks/RetryTaskUseCase';
import { StreamTaskLogsUseCase } from '../../application/tasks/StreamTaskLogsUseCase';
import { SSELogger } from '../../infrastructure/logging/SSELogger';
import { TaskAggregate } from '../../domain/task/Task.aggregate';
import { TaskResponseDto } from '../dtos/task.dto';

/** Converte um TaskAggregate para o DTO de resposta (snake_case para o frontend). */
function toDto(task: TaskAggregate): TaskResponseDto {
    return {
        id: task.id.value,
        parent_id: task.parentId.value,
        title: task.title,
        description: task.description,
        repository: task.repository,
        branch: task.branch.value,
        status: task.status.value,
        model: task.model ?? null,
        commit_url: task.commitUrl ?? null,
        logs: task.logs ?? null,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
    };
}

export class TasksController {
    constructor(
        private readonly listTasks: ListTasksUseCase,
        private readonly deleteTask: DeleteTaskUseCase,
        private readonly retryTask: RetryTaskUseCase,
        private readonly streamLogs: StreamTaskLogsUseCase,
        private readonly sseLogger: SSELogger,
    ) { }

    /** GET /tasks */
    async list(_req: Request, res: Response): Promise<void> {
        const tasks = await this.listTasks.execute();
        res.json(tasks.map(toDto));
    }

    /** GET /tasks/:id/logs/stream — Server-Sent Events */
    async streamTaskLogs(req: Request, res: Response): Promise<void> {
        const taskId = String(req.params.id);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

        const result = await this.streamLogs.execute(taskId);

        if (result.type === 'history') {
            // Tarefa concluída — envia histórico e fecha
            send({ type: 'history', entries: result.entries });
            send({ type: 'done', status: result.finalStatus });
            res.end();
            return;
        }

        // Tarefa em andamento — envia buffer e mantém conexão aberta
        if (result.bufferedEntries.length > 0) {
            send({ type: 'history', entries: result.bufferedEntries });
        }

        const onLog = (entry: object) => send({ type: 'log', entry });
        this.sseLogger.on(result.eventName, onLog);
        const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);

        req.on('close', () => {
            this.sseLogger.off(result.eventName, onLog);
            clearInterval(heartbeat);
        });
    }

    /** DELETE /tasks/:id */
    async delete(req: Request, res: Response): Promise<void> {
        const taskId = String(req.params.id);
        await this.deleteTask.execute({ taskId });
        res.json({ success: true, id: taskId });
    }

    /** POST /tasks/:id/retry */
    async retry(req: Request, res: Response): Promise<void> {
        const taskId = String(req.params.id);
        const result = await this.retryTask.execute({ taskId });

        switch (result.type) {
            case 'ok':
                res.json({ success: true, id: taskId });
                break;
            case 'not_found':
                res.status(404).json({ success: false, error: 'Tarefa não encontrada.' });
                break;
            case 'conflict':
                res.status(409).json({
                    success: false,
                    error: 'A tarefa está sendo processada. Aguarde antes de reprocessar.',
                    state: result.currentState,
                });
                break;
        }
    }
}
