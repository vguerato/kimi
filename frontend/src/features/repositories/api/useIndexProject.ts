import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { REPO_STATUS_QUERY_KEY } from './useGetRepoStatus';

interface IndexProjectResponse {
    success: boolean;
    message?: string;
}

/**
 * Dispara a indexação de contexto de um projeto específico.
 * A indexação roda em background no servidor — a resposta é imediata.
 */
export function useIndexProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (prefix: string) =>
            api.post<IndexProjectResponse>(`/api/projects/${encodeURIComponent(prefix)}/index`),
        onSuccess: (_data, prefix) => {
            toast.info(`Indexação do projeto "${prefix}" iniciada...`);
            // Invalida o status após um delay para dar tempo ao servidor processar
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: REPO_STATUS_QUERY_KEY });
            }, 3000);
        },
        onError: (_err, prefix) => {
            toast.error(`Erro ao iniciar indexação de "${prefix}".`);
        },
    });
}
