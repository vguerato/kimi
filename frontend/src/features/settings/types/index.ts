export interface AppSettings {
    git_pat: string;
    github_username: string;
    jira_url: string;
    jira_email: string;
    jira_token: string;
    azure_devops_org: string;
    azure_devops_project: string;
    azure_devops_token: string;
    repo_mappings: string;
    project_manager?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
    git_pat: '',
    github_username: '',
    jira_url: '',
    jira_email: '',
    jira_token: '',
    azure_devops_org: '',
    azure_devops_project: '',
    azure_devops_token: '',
    repo_mappings: '{}',
    project_manager: 'jira',
};

export type SettingsTab = 'geral' | 'integracao' | 'git';
