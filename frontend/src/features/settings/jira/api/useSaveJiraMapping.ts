import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { JIRA_MAPPING_QUERY_KEY } from './useGetJiraMapping';
import type { JiraMapping } from '../types';

export function useSaveJiraMapping() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (mapping: JiraMapping) =>
            api.post('/api/jira/mapping', mapping),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: JIRA_MAPPING_QUERY_KEY });
            toast.success('Mapeamento Jira salvo!');
        },
        onError: () => toast.error('Erro ao salvar mapeamento.'),
    });
}
