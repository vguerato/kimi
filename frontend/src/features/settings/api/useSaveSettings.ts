import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { SETTINGS_QUERY_KEY } from './useGetSettings';
import type { AppSettings } from '../types';
import type { RepoMapping } from '@/features/repositories';

interface SaveSettingsResponse {
    jiraValid?: boolean;
}

interface SaveSettingsPayload {
    settings: AppSettings;
    repoMappings: RepoMapping[];
}

export function useSaveSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ settings, repoMappings }: SaveSettingsPayload) => {
            const mappingObj = repoMappings.reduce<Record<string, string>>((acc, m) => {
                if (m.prefix && m.url) acc[m.prefix] = m.url;
                return acc;
            }, {});
            const payload: AppSettings = {
                ...settings,
                repo_mappings: JSON.stringify(mappingObj),
            };
            return api.post<SaveSettingsResponse>('/api/settings', payload);
        },
        onMutate: () => toast.loading('Salvando...'),
        onSuccess: (data, _vars, toastId) => {
            toast.dismiss(toastId as string);
            toast.success('Configurações salvas!');
            queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });

            if (data.jiraValid === true) toast.success('Credenciais do Jira validadas! 🎉');
            if (data.jiraValid === false) toast.error('Credenciais do Jira inválidas. Verifique URL, Email e Token.');
        },
        onError: (_err, _vars, toastId) => {
            toast.dismiss(toastId as string);
            toast.error('Erro ao salvar!');
        },
    });
}
