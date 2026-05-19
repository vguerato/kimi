/**
 * RetryTaskUseCase — Reenfileira uma tarefa para reprocessamento.
 *
 * Regras de negócio:
 *   - Tarefa não encontrada → erro NotFound
 *   - Tarefa com job ativo na fila → erro Conflict (não interrompe execução em andamento)
 *   - Qualquer outro estado → remove job antigo, reseta status para 'em fila', reenfileira
 */

import { ITaskRepository } from '../../domain/task/ports/ITaskRepository';
import { ITaskQueue } from '../../domain/task/ports/ITaskQueue';
import { TaskId } from '../../domain/task/value-objects/TaskId';
import { AgentTaskPayload } from '../../domain/shared/AgentTaskPayload';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'retry-task-use-case' });

export interface RetryTaskInput {
    taskId: string;
}

export type RetryTaskResult =
    | { type: 'ok' }
    | { type: 'not_found' }
    | { type: 'conflict'; currentState: string };

export class RetryTaskUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly taskQueue: ITaskQueue,
    ) { }

    async execute(input: RetryTaskInput): Promise<RetryTaskResult> {
        const id = TaskId.create(input.taskId);
        const task = await this.taskRepo.findById(id);

        if (!task) {
            return { type: 'not_found' };
        }

        // Verifica se já está sendo processado ativamente
        const jobState = await this.taskQueue.getJobState(input.taskId);
        if (jobState === 'active') {
            return { type: 'conflict', currentState: jobState };
        }

        // Remove job antigo (se existir) e reenfileira
        await this.taskQueue.removeJob(input.taskId).catch(() => { /* job pode não existir */ });

        task.queue();
        await this.taskRepo.update(task);

        await this.taskQueue.enqueue(
            {
                taskId: task.id.value,
                parentId: task.parentId.value,
                parentTitle: '',
                parentDescription: '',
                repository: task.repository,
                title: task.title || task.id.value,
                description: task.description || '',
                branch: task.branch.value,
            } satisfies AgentTaskPayload,
            { jobId: input.taskId },
        );

        log.info({ taskId: input.taskId }, 'Tarefa reenfileirada para retry');
        return { type: 'ok' };
    }
}
