import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function useSetupProviderWebhook(provider: string) {
    return useMutation({
        mutationFn: () => api.post(`/api/project-manager/${provider}/setup-webhook`),
        onSuccess: () => toast.success('Webhook registrado com sucesso!'),
        onError: () => toast.error('Erro ao registrar webhook.'),
    });
}

/** @deprecated Use useSetupProviderWebhook instead */
export function useSetupWebhook() {
    return useSetupProviderWebhook('jira');
}
