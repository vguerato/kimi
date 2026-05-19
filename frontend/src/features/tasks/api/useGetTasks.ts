import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Task } from '../types';

const getTasks = (): Promise<Task[]> => api.get<Task[]>('/api/tasks');

export const TASKS_QUERY_KEY = ['tasks'] as const;

export function useGetTasks() {
    return useQuery({
        queryKey: TASKS_QUERY_KEY,
        queryFn: getTasks,
        refetchInterval: 4000,
    });
}
