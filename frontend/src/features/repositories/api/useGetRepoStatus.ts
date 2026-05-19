import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RepoStatusMap } from '../types';

const getRepoStatus = (): Promise<RepoStatusMap> => api.get<RepoStatusMap>('/api/repos/status');

export const REPO_STATUS_QUERY_KEY = ['repos', 'status'] as const;

export function useGetRepoStatus() {
    return useQuery({
        queryKey: REPO_STATUS_QUERY_KEY,
        queryFn: getRepoStatus,
        refetchInterval: 4000,
    });
}
