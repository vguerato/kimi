import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TASKS_QUERY_KEY } from './useGetTasks';

interface DeleteTaskResponse {
    success: boolean;
    error?: string;
}

export function useDeleteTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (taskId: string) =>
            api.delete<DeleteTaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}`),
        onSuccess: (data, taskId) => {
            if (data.success) {
                queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
                toast.success(`Tarefa ${taskId} removida.`);
            } else {
                toast.error(`Erro ao remover tarefa: ${data.error}`);
            }
        },
        onError: () => toast.error('Erro de comunicação ao remover tarefa.'),
    });
}
