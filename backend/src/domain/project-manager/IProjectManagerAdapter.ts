/**
 * IProjectManagerAdapter — Port for project management integrations.
 *
 * Any project manager (Jira, Azure DevOps, Linear, etc.) must implement
 * this interface. The rest of the system depends only on this abstraction.
 *
 * All types are defined in the domain layer — no concrete adapter imports.
 */

import type {
    ProjectManagerConfig,
    ProjectManagerMapping,
} from './ProjectManagerIssue';

export type ProjectManagerType = 'jira' | 'azure-devops';

export interface IProjectManagerAdapter {
    readonly type: ProjectManagerType;

    /** Validates the stored credentials. Returns true if they work. */
    validateCredentials(): Promise<boolean>;

    /** Fetches available statuses and issue types for the admin to configure. */
    fetchConfig(): Promise<ProjectManagerConfig>;

    /** Returns the persisted task mapping, or null if not yet configured. */
    getMapping(): Promise<ProjectManagerMapping | null>;

    /** Persists the admin-configured task mapping. */
    saveMapping(mapping: Omit<ProjectManagerMapping, 'savedAt'>): Promise<ProjectManagerMapping>;

    /** Processes an incoming webhook payload from the project manager. */
    processWebhook(payload: unknown): Promise<void>;

    /** Creates a webhook registration in the project manager. */
    createWebhook(webhookUrl: string): Promise<WebhookResult>;

    /** Adds a label to an issue. */
    addLabel(issueKey: string, label: string): Promise<void>;

    /** Adds a comment to an issue. */
    addComment(issueKey: string, body: string): Promise<void>;

    /** Transitions an issue to the given status name. */
    updateTaskStatus(issueKey: string, statusName: string): Promise<void>;
}

export interface WebhookResult {
    success: boolean;
    id?: number | string;
    error?: string;
}
