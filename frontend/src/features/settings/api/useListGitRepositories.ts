import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface GitRepository {
    name: string;
    fullName: string;
    cloneUrl: string;
    webUrl: string;
    description: string | null;
    private: boolean;
    language: string | null;
    pushedAt: string | null;
    indexed: boolean;
    indexedAt: string | null;
    mapped: boolean;
    currentPrefix: string | null;
}

export const GIT_REPOS_QUERY_KEY = ['git', 'repositories'] as const;

export function useListGitRepositories(enabled: boolean) {
    return useQuery({
        queryKey: GIT_REPOS_QUERY_KEY,
        queryFn: () => api.get<GitRepository[]>('/api/git/repositories'),
        enabled,
        staleTime: 30_000,
    });
}
