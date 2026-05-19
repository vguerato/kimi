/**
 * DeleteTaskUseCase — Remove uma tarefa do banco e da fila.
 *
 * A remoção da fila é best-effort: se o job não existir ou já tiver
 * sido processado, o erro é logado mas não impede a remoção do banco.
 */

import { ITaskRepository } from '../../domain/task/ports/ITaskRepository';
import { ITaskQueue } from '../../domain/task/ports/ITaskQueue';
import { TaskId } from '../../domain/task/value-objects/TaskId';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'delete-task-use-case' });

export interface DeleteTaskInput {
    taskId: string;
}

export class DeleteTaskUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly taskQueue: ITaskQueue,
    ) { }

    async execute(input: DeleteTaskInput): Promise<void> {
        const id = TaskId.create(input.taskId);

        // Remove da fila (best-effort)
        await this.taskQueue.removeJob(input.taskId).catch(err =>
            log.warn({ err, taskId: input.taskId }, 'Falha ao remover job da fila'),
        );

        // Remove do banco
        await this.taskRepo.deleteById(id);
    }
}
