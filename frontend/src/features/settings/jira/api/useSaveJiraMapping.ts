import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { pmMappingQueryKey } from './useGetJiraMapping';
import type { PMMapping } from '../types';

export function useSavePMMapping(provider: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (mapping: PMMapping) =>
            api.post(`/api/project-manager/${provider}/mapping`, mapping),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: pmMappingQueryKey(provider) });
            toast.success('Mapeamento salvo!');
        },
        onError: () => toast.error('Erro ao salvar mapeamento.'),
    });
}

/** @deprecated Use useSavePMMapping instead */
export function useSaveJiraMapping() {
    return useSavePMMapping('jira');
}
