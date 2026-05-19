import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PMConfig } from '../types';

const getPMConfig = (provider: string): Promise<PMConfig> =>
    api.get<PMConfig>(`/api/project-manager/${provider}/config`);

/** Lazy-loaded — only fetches when the user clicks "Carregar configuração". */
export function useLoadPMConfig(provider: string) {
    return useMutation({
        mutationFn: () => getPMConfig(provider),
    });
}

/** @deprecated Use useLoadPMConfig instead */
export function useLoadJiraConfig() {
    return useLoadPMConfig('jira');
}
