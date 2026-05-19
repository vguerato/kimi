import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { TASKS_QUERY_KEY } from './useGetTasks';

interface RetryTaskResponse {
    success: boolean;
    error?: string;
}

export function useRetryTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (taskId: string) =>
            api.post<RetryTaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}/retry`),
        onSuccess: (data, taskId) => {
            if (data.success) {
                queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
                toast.success(`Tarefa ${taskId} reenviada para reprocessamento! 🔄`);
            } else {
                toast.error(`Erro ao reprocessar: ${data.error}`);
            }
        },
        onError: (error: Error) => {
            // 409 Conflict — task already processing
            if (error.message) {
                toast.warning(`⏳ ${error.message}`);
            } else {
                toast.error('Erro de comunicação ao reprocessar tarefa.');
            }
        },
    });
}
