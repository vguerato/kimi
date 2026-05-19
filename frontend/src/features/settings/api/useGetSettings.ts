import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppSettings } from '../types';

const getSettings = (): Promise<AppSettings> => api.get<AppSettings>('/api/settings');

export const SETTINGS_QUERY_KEY = ['settings'] as const;

export function useGetSettings() {
    return useQuery({
        queryKey: SETTINGS_QUERY_KEY,
        queryFn: getSettings,
    });
}
