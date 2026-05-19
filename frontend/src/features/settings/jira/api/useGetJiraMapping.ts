import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JiraMapping } from '../types';

interface JiraMappingResponse {
    mapping: JiraMapping | null;
}

const getJiraMapping = (): Promise<JiraMappingResponse> =>
    api.get<JiraMappingResponse>('/api/jira/mapping');

export const JIRA_MAPPING_QUERY_KEY = ['jira', 'mapping'] as const;

export function useGetJiraMapping() {
    return useQuery({
        queryKey: JIRA_MAPPING_QUERY_KEY,
        queryFn: getJiraMapping,
    });
}
