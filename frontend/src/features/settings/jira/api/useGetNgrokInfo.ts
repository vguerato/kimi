import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NgrokInfo } from '../types';

const getNgrokInfo = (): Promise<NgrokInfo> => api.get<NgrokInfo>('/api/ngrok-url');

export function useGetNgrokInfo() {
    return useQuery({
        queryKey: ['ngrok-info'],
        queryFn: getNgrokInfo,
    });
}
