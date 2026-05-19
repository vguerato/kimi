/**
 * TaskId — Value object that wraps a task identifier string.
 *
 * Ensures the ID is never empty and provides a typed boundary
 * so raw strings cannot be accidentally passed where a TaskId is expected.
 */
export class TaskId {
    private constructor(readonly value: string) { }

    static create(raw: string): TaskId {
        const trimmed = raw?.trim();
        if (!trimmed) throw new Error('TaskId cannot be empty');
        return new TaskId(trimmed);
    }

    equals(other: TaskId): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
