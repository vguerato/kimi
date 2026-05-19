export interface AppSettings {
    git_pat: string;
    github_username: string;
    jira_url: string;
    jira_email: string;
    jira_token: string;
    repo_mappings: string;
    project_manager?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
    git_pat: '',
    github_username: '',
    jira_url: '',
    jira_email: '',
    jira_token: '',
    repo_mappings: '{}',
    project_manager: 'jira',
};

export type SettingsTab = 'geral' | 'integracao' | 'jira' | 'git';
