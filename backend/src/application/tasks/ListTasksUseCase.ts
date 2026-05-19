/**
 * ListTasksUseCase — Retorna todas as tarefas ordenadas por data de atualização.
 */

import { ITaskRepository } from '../../domain/task/ports/ITaskRepository';
import { TaskAggregate } from '../../domain/task/Task.aggregate';

export class ListTasksUseCase {
    constructor(private readonly taskRepo: ITaskRepository) { }

    async execute(): Promise<TaskAggregate[]> {
        return this.taskRepo.findAll();
    }
}
