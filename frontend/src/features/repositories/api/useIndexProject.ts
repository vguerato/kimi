import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { REPO_STATUS_QUERY_KEY } from './useGetRepoStatus';

interface IndexProjectResponse {
    success: boolean;
    message?: string;
}

interface IndexProjectInput {
    /** Identificador do projeto na memória (nome do repo ou prefixo de tarefa). */
    prefix: string;
    /**
     * URL de clone do repositório.
     * Quando fornecida, a indexação não depende do repo_mappings.
     */
    repoUrl?: string;
}

/**
 * Dispara a indexação de contexto de um projeto específico.
 * A indexação roda em background no servidor — a resposta é imediata.
 */
export function useIndexProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ prefix, repoUrl }: IndexProjectInput) =>
            api.post<IndexProjectResponse>(
                `/api/projects/${encodeURIComponent(prefix)}/index`,
                repoUrl ? { repoUrl } : {},
            ),
        onSuccess: (_data, { prefix }) => {
            toast.info(`Indexação do projeto "${prefix}" iniciada...`);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: REPO_STATUS_QUERY_KEY });
            }, 3000);
        },
        onError: (_err, { prefix }) => {
            toast.error(`Erro ao iniciar indexação de "${prefix}".`);
        },
    });
}
