import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface GitConnectionStatus {
    connected: boolean;
    login?: string;
    name?: string;
    avatarUrl?: string;
}

export const GIT_VALIDATE_QUERY_KEY = ['git', 'validate'] as const;

export function useValidateGitConnection(enabled: boolean) {
    return useQuery({
        queryKey: GIT_VALIDATE_QUERY_KEY,
        queryFn: () => api.get<GitConnectionStatus>('/api/git/validate'),
        enabled,
        staleTime: 60_000,
        retry: false,
    });
}
