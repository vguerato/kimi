import { useState, useEffect, useRef } from 'react';
import { useGetSettings } from '@/features/settings';
import { useGetRepoStatus } from '@/features/repositories';
import { toast } from 'sonner';
import type { RepoMapping } from '@/features/repositories';

const DEFAULT_MAPPINGS: RepoMapping[] = [{ prefix: '', url: '' }];

/**
 * Gerencia o estado dos mapeamentos de repositório.
 *
 * Sincroniza com as configurações do servidor no carregamento inicial.
 * No v2, o status de repositório reflete indexação de contexto (não clone local),
 * então os toasts notificam sobre mudanças de indexação.
 */
export function useRepoMappings() {
    const [repoMappings, setRepoMappings] = useState<RepoMapping[]>(DEFAULT_MAPPINGS);
    const { data: serverSettings } = useGetSettings();
    const { data: repoStatus = {} } = useGetRepoStatus();
    const prevStatusRef = useRef<Record<string, string>>({});

    // Sincroniza mapeamentos das configurações do servidor no primeiro carregamento
    useEffect(() => {
        if (!serverSettings?.repo_mappings) return;
        try {
            const parsed = JSON.parse(serverSettings.repo_mappings);
            const entries = Object.entries(parsed).map(([prefix, url]) => ({
                prefix,
                url: String(url),
            }));
            if (entries.length > 0) setRepoMappings(entries);
        } catch {
            // ignora JSON malformado
        }
    }, [serverSettings]);

    // Notificações toast quando o status de indexação muda
    useEffect(() => {
        for (const [prefix, status] of Object.entries(repoStatus)) {
            const prev = prevStatusRef.current[prefix];

            // Indexação concluída
            if (prev === 'cloning' && status === 'ready') {
                toast.success(`Contexto do projeto "${prefix}" indexado com sucesso! ✅`);
            }
            // Falha na indexação
            if (prev === 'cloning' && status === 'error') {
                toast.error(`Erro ao indexar contexto de "${prefix}". Verifique as configurações.`);
            }
            // Projeto recém-configurado ficou disponível
            if (prev === 'pending' && status === 'ready') {
                toast.success(`Projeto "${prefix}" pronto para uso! ✅`);
            }
        }
        prevStatusRef.current = repoStatus;
    }, [repoStatus]);

    return { repoMappings, setRepoMappings };
}
