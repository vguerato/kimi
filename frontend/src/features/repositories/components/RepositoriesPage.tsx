import { useState } from 'react';
import { GitBranch, MoreHorizontal, RefreshCw } from 'lucide-react';
import { useGetRepoStatus } from '../api/useGetRepoStatus';
import { useIndexProject } from '../api/useIndexProject';
import { RepoStatusBadge } from './RepoStatusBadge';
import { Topbar } from '@/app/Topbar';
import type { RepoMapping } from '../types';

interface RepositoriesPageProps {
  repoMappings: RepoMapping[];
}

export function RepositoriesPage({ repoMappings }: RepositoriesPageProps) {
  const { data: repoStatus = {} } = useGetRepoStatus();
  const { mutate: indexProject, isPending: isIndexing } = useIndexProject();
  const [search, setSearch] = useState('');
  const [indexingPrefix, setIndexingPrefix] = useState<string | null>(null);

  const configuredRepos = repoMappings.filter(m => m.prefix);
  const filtered = search
    ? configuredRepos.filter(m =>
        m.prefix.toLowerCase().includes(search.toLowerCase()) ||
        m.url.toLowerCase().includes(search.toLowerCase())
      )
    : configuredRepos;

  const handleIndex = (prefix: string) => {
    setIndexingPrefix(prefix);
    indexProject(prefix, {
      onSettled: () => setIndexingPrefix(null),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar
        searchPlaceholder="Buscar repositório..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Repositórios Configurados</h1>
            <p className="text-sm mt-1 text-muted">
              Gerencie os repositórios mapeados para delegação de tarefas e acompanhe o status de indexação de contexto.
            </p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-surface border border-border">
          <div
            className="grid px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted border-b border-border"
            style={{ gridTemplateColumns: '2fr 2fr 160px 100px' }}
          >
            <span>REPOSITÓRIO</span>
            <span>URL DO GIT</span>
            <span>CONTEXTO</span>
            <span className="text-right">AÇÕES</span>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 flex flex-col items-center gap-3 text-muted">
              <GitBranch size={32} className="text-muted" />
              <p className="text-sm">Nenhum repositório configurado.</p>
              <p className="text-xs text-muted">Adicione mapeamentos na página de Configurações → Git.</p>
            </div>
          )}

          {filtered.map((mapping, i) => (
            <div
              key={i}
              className="grid px-5 py-4 items-center transition-colors hover:bg-surface-secondary border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: '2fr 2fr 160px 100px' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-default text-muted">
                  <GitBranch size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{mapping.prefix}</p>
                  <p className="text-xs text-muted">Prefixo: {mapping.prefix.toUpperCase()}</p>
                </div>
              </div>

              <span className="text-sm text-muted truncate pr-4">{mapping.url || '—'}</span>

              <RepoStatusBadge status={repoStatus[mapping.prefix]} />

              <div className="flex justify-end gap-1">
                {/* Botão de indexar contexto */}
                <button
                  onClick={() => handleIndex(mapping.prefix)}
                  disabled={isIndexing && indexingPrefix === mapping.prefix}
                  className="p-1.5 rounded-lg transition-colors text-muted hover:text-accent hover:bg-accent-soft disabled:opacity-50"
                  title="Indexar contexto do projeto"
                >
                  <RefreshCw
                    size={14}
                    className={isIndexing && indexingPrefix === mapping.prefix ? 'animate-spin' : ''}
                  />
                </button>
                <button
                  className="p-1.5 rounded-lg transition-colors text-muted hover:text-foreground hover:bg-default"
                  title="Mais opções"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            Contexto indexado — agente pode usar informações do projeto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-default-400 inline-block" />
            Pendente — clique em <RefreshCw size={10} className="inline" /> para indexar
          </span>
        </div>
      </div>
    </div>
  );
}
