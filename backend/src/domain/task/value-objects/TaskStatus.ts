/**
 * TaskStatus — Value object representing the lifecycle state of a task.
 *
 * Valid transitions:
 *   queued → processing → waiting_review | error
 *   error  → queued  (retry)
 */

export type TaskStatusValue =
    | 'em fila'
    | 'processando'
    | 'em espera'
    | 'error';

export class TaskStatus {
    private constructor(readonly value: TaskStatusValue) { }

    static queued(): TaskStatus { return new TaskStatus('em fila'); }
    static processing(): TaskStatus { return new TaskStatus('processando'); }
    static waiting(): TaskStatus { return new TaskStatus('em espera'); }
    static failed(): TaskStatus { return new TaskStatus('error'); }

    static fromRaw(raw: string): TaskStatus {
        const valid: TaskStatusValue[] = ['em fila', 'processando', 'em espera', 'error'];
        if (valid.includes(raw as TaskStatusValue)) return new TaskStatus(raw as TaskStatusValue);
        throw new Error(`Invalid TaskStatus: "${raw}"`);
    }

    isQueued(): boolean { return this.value === 'em fila'; }
    isProcessing(): boolean { return this.value === 'processando'; }
    isWaiting(): boolean { return this.value === 'em espera'; }
    isFailed(): boolean { return this.value === 'error'; }

    equals(other: TaskStatus): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
