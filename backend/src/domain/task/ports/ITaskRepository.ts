/**
 * ITaskRepository — Port for task persistence.
 *
 * Implementations live in infrastructure/. The domain and application
 * layers depend only on this interface (DIP).
 */

import { TaskAggregate } from '../Task.aggregate';
import { TaskId } from '../value-objects/TaskId';
import { TaskStatusValue } from '../value-objects/TaskStatus';

export interface ITaskRepository {
    /** Persists a new task. */
    save(task: TaskAggregate): Promise<void>;

    /** Updates an existing task. */
    update(task: TaskAggregate): Promise<void>;

    /** Finds a task by its ID. Returns null if not found. */
    findById(id: TaskId): Promise<TaskAggregate | null>;

    /** Returns all tasks, ordered by updatedAt descending. */
    findAll(): Promise<TaskAggregate[]>;

    /** Returns tasks matching any of the given statuses. */
    findByStatuses(statuses: TaskStatusValue[]): Promise<TaskAggregate[]>;

    /** Deletes a task by ID. */
    deleteById(id: TaskId): Promise<void>;
}
