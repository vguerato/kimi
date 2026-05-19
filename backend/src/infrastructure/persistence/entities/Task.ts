import 'reflect-metadata';
import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Represents a unit of work delegated to the agent.
 *
 * A task can be:
 *   - A standalone issue (no subtasks) — executed directly
 *   - A subtask of a parent issue — executed with parent context
 *
 * The agent always executes at the Task level. Parent issues provide context.
 */
@Entity('tasks')
export class Task {
    /** Issue key, e.g. SCRUM-14 */
    @PrimaryColumn({ type: 'text' })
    id!: string;

    /**
     * Key of the parent issue, if this task is a subtask.
     * Equals id for standalone tasks.
     */
    @Column({ name: 'parent_id', type: 'text', nullable: true })
    parentId!: string;

    @Column({ type: 'text', nullable: true })
    title!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'text', nullable: true })
    repository!: string;

    @Column({ type: 'text', nullable: true })
    branch!: string;

    @Column({ type: 'text', nullable: true })
    status!: string;

    @Column({ type: 'text', nullable: true })
    logs!: string | null;

    @Column({ type: 'text', nullable: true })
    model!: string | null;

    @Column({ name: 'commit_url', type: 'text', nullable: true })
    commitUrl!: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
