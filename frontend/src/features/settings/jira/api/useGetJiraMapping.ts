import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PMMapping } from '../types';

interface MappingResponse {
    mapping: PMMapping | null;
}

const getPMMapping = (provider: string): Promise<MappingResponse> =>
    api.get<MappingResponse>(`/api/project-manager/${provider}/mapping`);

export const pmMappingQueryKey = (provider: string) => ['project-manager', provider, 'mapping'] as const;

/** @deprecated Use pmMappingQueryKey instead */
export const JIRA_MAPPING_QUERY_KEY = pmMappingQueryKey('jira');

export function useGetPMMapping(provider: string) {
    return useQuery({
        queryKey: pmMappingQueryKey(provider),
        queryFn: () => getPMMapping(provider),
    });
}

/** @deprecated Use useGetPMMapping instead */
export function useGetJiraMapping() {
    return useGetPMMapping('jira');
}
