import 'reflect-metadata';
import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Key/value store for all application configuration:
 * Jira credentials, Git PAT, repo mappings, LLM-generated Jira mapping, etc.
 */
@Entity('settings')
export class Setting {
    @PrimaryColumn({ type: 'text' })
    key!: string;

    @Column({ type: 'text', nullable: true })
    value!: string;
}
