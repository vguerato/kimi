export interface JiraStatus {
    name: string;
    statusCategory: string;
}

export interface JiraIssueType {
    name: string;
    subtask: boolean;
}

export interface JiraConfig {
    statuses: JiraStatus[];
    issueTypes: JiraIssueType[];
}

export interface JiraMapping {
    triggerStatuses: string[];
    skipStatuses: string[];
    delegatableTypes: string[];
    parentTypes: string[];
    savedAt?: string;
}

export interface NgrokInfo {
    url: string | null;
    webhookUrl: string | null;
}
