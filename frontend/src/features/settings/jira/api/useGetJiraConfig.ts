import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JiraConfig } from '../types';

const getJiraConfig = (): Promise<JiraConfig> => api.get<JiraConfig>('/api/jira/config');

/** Lazy-loaded — only fetches when the user clicks "Carregar do Jira" */
export function useLoadJiraConfig() {
    return useMutation({
        mutationFn: getJiraConfig,
    });
}
