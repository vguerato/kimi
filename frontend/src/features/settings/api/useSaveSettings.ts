import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { SETTINGS_QUERY_KEY } from './useGetSettings';
import { GIT_VALIDATE_QUERY_KEY } from './useValidateGitConnection';
import type { AppSettings } from '../types';
import type { RepoMapping } from '@/features/repositories';

interface SaveSettingsResponse {
    jiraValid?: boolean;
    gitValid?: boolean | null;
    gitLogin?: string;
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

            // Atualiza o cache de validação Git com o resultado do save
            if (data.gitValid !== undefined && data.gitValid !== null) {
                queryClient.setQueryData(GIT_VALIDATE_QUERY_KEY, {
                    connected: data.gitValid,
                    login: data.gitLogin,
                });
                if (data.gitValid) {
                    toast.success(`GitHub conectado como ${data.gitLogin} ✓`);
                } else {
                    toast.error('Git PAT inválido ou sem permissão.');
                }
            } else if (data.gitValid === false) {
                queryClient.setQueryData(GIT_VALIDATE_QUERY_KEY, { connected: false });
                toast.error('Git PAT inválido ou sem permissão.');
            }

            if (data.jiraValid === true) toast.success('Credenciais do Jira validadas! 🎉');
            if (data.jiraValid === false) toast.error('Credenciais do Jira inválidas. Verifique URL, Email e Token.');
        },
        onError: (_err, _vars, toastId) => {
            toast.dismiss(toastId as string);
            toast.error('Erro ao salvar!');
        },
    });
}
