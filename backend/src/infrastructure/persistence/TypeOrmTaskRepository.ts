/**
 * TypeOrmTaskRepository — Implementação de ITaskRepository via TypeORM.
 *
 * Mapeia entre o aggregate de domínio (TaskAggregate) e a entidade de
 * persistência (Task). O domínio nunca conhece o TypeORM — apenas esta
 * camada faz a tradução.
 */

import { inject, injectable } from 'tsyringe';
import { DataSource } from 'typeorm';
import { TOKENS } from '../../bootstrap/tokens';
import { ITaskRepository } from '../../domain/task/ports/ITaskRepository';
import { TaskAggregate } from '../../domain/task/Task.aggregate';
import { TaskId } from '../../domain/task/value-objects/TaskId';
import { TaskStatus, TaskStatusValue } from '../../domain/task/value-objects/TaskStatus';
import { BranchName } from '../../domain/task/value-objects/BranchName';
import { Task } from './entities/Task';

@injectable()
export class TypeOrmTaskRepository implements ITaskRepository {
    constructor(
        @inject(TOKENS.DataSource) private readonly dataSource: DataSource,
    ) { }

    async save(task: TaskAggregate): Promise<void> {
        const repo = this.dataSource.getRepository(Task);
        const entity = this.toEntity(task);
        await repo.save(entity);
    }

    async update(task: TaskAggregate): Promise<void> {
        const repo = this.dataSource.getRepository(Task);
        await repo.update(task.id.value, {
            status: task.status.value,
            title: task.title,
            description: task.description,
            model: task.model ?? null,
            commitUrl: task.commitUrl ?? null,
            logs: task.logs ?? null,
        });
    }

    async findById(id: TaskId): Promise<TaskAggregate | null> {
        const repo = this.dataSource.getRepository(Task);
        const entity = await repo.findOneBy({ id: id.value });
        if (!entity) return null;
        return this.toDomain(entity);
    }

    async findAll(): Promise<TaskAggregate[]> {
        const repo = this.dataSource.getRepository(Task);
        const entities = await repo.find({ order: { updatedAt: 'DESC' } });
        return entities.map(e => this.toDomain(e));
    }

    async findByStatuses(statuses: TaskStatusValue[]): Promise<TaskAggregate[]> {
        const repo = this.dataSource.getRepository(Task);
        const entities = await repo
            .createQueryBuilder('task')
            .where('task.status IN (:...statuses)', { statuses })
            .orderBy('task.updatedAt', 'ASC')
            .getMany();
        return entities.map(e => this.toDomain(e));
    }

    async deleteById(id: TaskId): Promise<void> {
        const repo = this.dataSource.getRepository(Task);
        await repo.delete(id.value);
    }

    // ─── Mapeamento domínio ↔ persistência ──────────────────────────────────────

    private toEntity(task: TaskAggregate): Task {
        const entity = new Task();
        entity.id = task.id.value;
        entity.parentId = task.parentId.value;
        entity.title = task.title;
        entity.description = task.description;
        entity.repository = task.repository;
        entity.branch = task.branch.value;
        entity.status = task.status.value;
        entity.model = task.model ?? null;
        entity.commitUrl = task.commitUrl ?? null;
        entity.logs = task.logs ?? null;
        return entity;
    }

    private toDomain(entity: Task): TaskAggregate {
        return TaskAggregate.create({
            id: TaskId.create(entity.id),
            parentId: TaskId.create(entity.parentId ?? entity.id),
            title: entity.title ?? '',
            description: entity.description ?? '',
            repository: entity.repository ?? '',
            branch: BranchName.fromRaw(entity.branch ?? 'main'),
            status: TaskStatus.fromRaw(entity.status ?? 'em fila'),
            model: entity.model ?? undefined,
            commitUrl: entity.commitUrl ?? undefined,
            logs: entity.logs ?? undefined,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        });
    }
}
