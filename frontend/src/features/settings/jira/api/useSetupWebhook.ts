import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function useSetupWebhook() {
    return useMutation({
        mutationFn: () => api.post('/api/jira/setup-webhook'),
        onSuccess: () => toast.success('Webhook registrado com sucesso!'),
        onError: () => toast.error('Erro ao registrar webhook.'),
    });
}
