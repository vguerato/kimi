// ── Generic Project Manager types ─────────────────────────────────────────────

export interface PMStatus {
    id: string;
    name: string;
    statusCategory: string;
}

export interface PMIssueType {
    id: string;
    name: string;
    subtask: boolean;
    description?: string;
}

export interface PMConfig {
    statuses: PMStatus[];
    issueTypes: PMIssueType[];
}

export interface PMMapping {
    triggerStatuses: string[];
    skipStatuses: string[];
    delegatableTypes: string[];
    parentTypes: string[];
    savedAt?: string;
}

// ── Legacy aliases (kept for backward compatibility) ──────────────────────────

/** @deprecated Use PMStatus */
export type JiraStatus = PMStatus;

/** @deprecated Use PMIssueType */
export type JiraIssueType = PMIssueType;

/** @deprecated Use PMConfig */
export type JiraConfig = PMConfig;

/** @deprecated Use PMMapping */
export type JiraMapping = PMMapping;

export interface NgrokInfo {
    url: string | null;
    webhookUrl: string | null;
}
