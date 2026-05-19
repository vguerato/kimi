/**
 * TaskAggregate — Root aggregate for the Task domain.
 *
 * Encapsulates all state transitions and business rules for a task.
 * No infrastructure dependencies — pure domain logic.
 */

import { TaskId } from './value-objects/TaskId';
import { TaskStatus } from './value-objects/TaskStatus';
import { BranchName } from './value-objects/BranchName';

export interface TaskProps {
    id: TaskId;
    parentId: TaskId;
    title: string;
    description: string;
    repository: string;
    branch: BranchName;
    status: TaskStatus;
    model?: string;
    commitUrl?: string;
    logs?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export class TaskAggregate {
    private _status: TaskStatus;
    private _title: string;
    private _description: string;
    private _model?: string;
    private _commitUrl?: string;
    private _logs?: string;

    readonly id: TaskId;
    readonly parentId: TaskId;
    readonly repository: string;
    readonly branch: BranchName;
    readonly createdAt: Date;
    updatedAt: Date;

    private constructor(props: TaskProps) {
        this.id = props.id;
        this.parentId = props.parentId;
        this.repository = props.repository;
        this.branch = props.branch;
        this._status = props.status;
        this._title = props.title;
        this._description = props.description;
        this._model = props.model;
        this._commitUrl = props.commitUrl;
        this._logs = props.logs;
        this.createdAt = props.createdAt ?? new Date();
        this.updatedAt = props.updatedAt ?? new Date();
    }

    static create(props: TaskProps): TaskAggregate {
        return new TaskAggregate(props);
    }

    // ─── Accessors ───────────────────────────────────────────────────────────────

    get status(): TaskStatus { return this._status; }
    get title(): string { return this._title; }
    get description(): string { return this._description; }
    get model(): string | undefined { return this._model; }
    get commitUrl(): string | undefined { return this._commitUrl; }
    get logs(): string | undefined { return this._logs; }

    // ─── State transitions ───────────────────────────────────────────────────────

    /** Marks the task as queued for processing. */
    queue(): void {
        this._status = TaskStatus.queued();
        this.touch();
    }

    /** Marks the task as actively being processed. */
    startProcessing(): void {
        this._status = TaskStatus.processing();
        this.touch();
    }

    /** Marks the task as completed and waiting for review. */
    complete(commitUrl?: string, logs?: string): void {
        this._status = TaskStatus.waiting();
        this._commitUrl = commitUrl;
        this._logs = logs;
        this.touch();
    }

    /** Marks the task as failed. */
    fail(logs?: string): void {
        this._status = TaskStatus.failed();
        this._logs = logs;
        this.touch();
    }

    /** Updates the model used for this task. */
    assignModel(model: string): void {
        this._model = model;
        this.touch();
    }

    /** Updates title and description (e.g. on retry with fresh data). */
    updateDetails(title: string, description: string): void {
        this._title = title;
        this._description = description;
        this.touch();
    }

    private touch(): void {
        this.updatedAt = new Date();
    }
}
