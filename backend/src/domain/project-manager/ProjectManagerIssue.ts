/**
 * ProjectManagerIssue — Agnóstic domain types for project management integrations.
 *
 * These types belong to the domain layer and must NOT import from any
 * concrete adapter (Jira, Azure DevOps, etc.). Adapters map their
 * provider-specific shapes into these types.
 */

export interface ProjectManagerIssue {
    id: string;
    type: string;
    title: string;
    description: string;
    repository: string;
    branch: string;
    parent?: {
        id: string;
        title: string;
        description: string;
    };
}

export interface ProjectManagerStatus {
    id: string;
    name: string;
    statusCategory: string;
}

export interface ProjectManagerIssueType {
    id: string;
    name: string;
    subtask: boolean;
    description: string;
}

/** Configuration data fetched from the project manager (statuses + issue types). */
export interface ProjectManagerConfig {
    statuses: ProjectManagerStatus[];
    issueTypes: ProjectManagerIssueType[];
}

/** Admin-configured mapping that controls which issues get delegated. */
export interface ProjectManagerMapping {
    /** Statuses that trigger task delegation. */
    triggerStatuses: string[];
    /** Statuses that cause a subtask to be skipped. */
    skipStatuses: string[];
    /** Issue types that can be delegated to the agent. */
    delegatableTypes: string[];
    /** Issue types treated as parent containers. */
    parentTypes: string[];
    /** ISO timestamp of when this mapping was last saved. */
    savedAt: string;
}
