import { useState, useEffect } from 'react';
import { TextField, Label, Input, Description } from '@heroui/react';
import { GitBranch, RefreshCw, Brain, Check, Lock, Globe, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';import { toast } from 'sonner';
import { PasswordField } from '@/components/PasswordField';
import { useIndexProject } from '@/features/repositories';
import type { RepoMapping } from '@/features/repositories';
import type { AppSettings } from '../types';
import { useListGitRepositories, type GitRepository } from '../api/useListGitRepositories';
import { useValidateGitConnection } from '../api/useValidateGitConnection';

interface GitTabProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  repoMappings: RepoMapping[];
  onRepoMappingsChange: (mappings: RepoMapping[]) => void;
}

// ── Connection status badge ────────────────────────────────────────────────────

function ConnectionBadge({ connected, login }: {
  connected: boolean | undefined;
  login?: string;
}) {
  if (connected === true) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <CheckCircle2 size={13} />
        Conectado{login ? ` como ${login}` : ''}
      </span>
    );
  }
  if (connected === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
        <XCircle size={13} />
        PAT inválido ou sem permissão
      </span>
    );
  }
  return null;
}

// ── Repo row ───────────────────────────────────────────────────────────────────

function RepoRow({ repo, selected, onToggle, indexing }: {
  repo: GitRepository;
  selected: boolean;
  onToggle: () => void;
  indexing: boolean;
}) {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  };

  return (
    <label
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
        ${selected
          ? 'border-accent bg-accent-soft'
          : 'border-border bg-surface-secondary hover:border-border-secondary'
        }`}
    >
      {/* Checkbox */}
      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors
        ${selected ? 'bg-accent border-accent' : 'border-border bg-surface'}`}
      >
        {selected && <Check size={10} className="text-white" strokeWidth={3} />}
      </div>
      <input type="checkbox" className="sr-only" checked={selected} onChange={onToggle} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">{repo.fullName}</span>
          {repo.private
            ? <Lock size={11} className="text-muted shrink-0" />
            : <Globe size={11} className="text-muted shrink-0" />
          }
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {repo.language && (
            <span className="text-xs text-muted">{repo.language}</span>
          )}
          {repo.description && (
            <span className="text-xs text-muted truncate max-w-[200px]">{repo.description}</span>
          )}
          {repo.pushedAt && (
            <span className="text-xs text-muted" title={`Último push: ${fmt(repo.pushedAt)}`}>
              Push: {fmt(repo.pushedAt)}
            </span>
          )}
        </div>
        {repo.indexed && repo.indexedAt && (
          <p className="text-xs text-success mt-0.5">
            Indexado em {fmt(repo.indexedAt)}
          </p>
        )}
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {repo.indexed && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success-soft text-success">
            <Brain size={10} />
            Indexado
          </span>
        )}
        {repo.mapped && !repo.indexed && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-default text-muted">
            Mapeado
          </span>
        )}
        {indexing && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-soft text-accent">
            <RefreshCw size={10} className="animate-spin" />
            Indexando...
          </span>
        )}
      </div>
    </label>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export function GitTab({ settings, onSettingsChange, onRepoMappingsChange }: GitTabProps) {
  // Status de conexão vem do cache — populado pelo botão "Salvar Configurações"
  // enabled=false: nunca faz fetch automático, só lê o cache
  const { data: gitStatus } = useValidateGitConnection(false);

  const isConnected = gitStatus?.connected === true;

  // Busca repos só quando a conexão está confirmada
  const { data: repos = [], isLoading: isLoadingRepos, isError: isReposError, refetch: refetchRepos } =
    useListGitRepositories(isConnected);

  const { mutate: indexProject, isPending: isIndexing } = useIndexProject();

  const [selectedFullNames, setSelectedFullNames] = useState<Set<string>>(new Set());
  const [indexingRepos, setIndexingRepos] = useState<Set<string>>(new Set());

  // Pré-seleciona repos já mapeados
  useEffect(() => {
    if (repos.length === 0) return;
    const alreadyMapped = new Set(repos.filter(r => r.mapped).map(r => r.fullName));
    setSelectedFullNames(prev => new Set([...prev, ...alreadyMapped]));
  }, [repos]);

  // Sincroniza repoMappings com a seleção
  useEffect(() => {
    if (repos.length === 0) return;
    const selected = repos.filter(r => selectedFullNames.has(r.fullName));
    onRepoMappingsChange(selected.map(r => ({ prefix: r.name, url: r.cloneUrl })));
  }, [selectedFullNames, repos]);

  const toggleRepo = (fullName: string) => {
    setSelectedFullNames(prev => {
      const next = new Set(prev);
      next.has(fullName) ? next.delete(fullName) : next.add(fullName);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedFullNames(
      selectedFullNames.size === repos.length
        ? new Set()
        : new Set(repos.map(r => r.fullName))
    );
  };

  const handleIndexSelected = () => {
    const toIndex = repos.filter(r => selectedFullNames.has(r.fullName) && !r.indexed);
    if (toIndex.length === 0) {
      toast.info('Todos os repositórios selecionados já estão indexados.');
      return;
    }
    toIndex.forEach(r => {
      setIndexingRepos(prev => new Set([...prev, r.fullName]));
      indexProject(
        { prefix: r.name, repoUrl: r.cloneUrl },
        { onSettled: () => setIndexingRepos(prev => { const n = new Set(prev); n.delete(r.fullName); return n; }) },
      );
    });
  };

  const allSelected = repos.length > 0 && selectedFullNames.size === repos.length;
  const someSelected = selectedFullNames.size > 0 && !allSelected;
  const selectedCount = selectedFullNames.size;
  const notIndexedCount = repos.filter(r => selectedFullNames.has(r.fullName) && !r.indexed).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Credentials ─────────────────────────────────────────────────── */}
      <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GitBranch size={18} className="text-muted" />
            <h2 className="font-semibold text-foreground">Git / GitHub</h2>
          </div>
          {gitStatus !== undefined && (
            <ConnectionBadge
              connected={gitStatus?.connected}
              login={gitStatus?.login}
            />
          )}
        </div>

        <TextField className="flex flex-col gap-1.5 w-full">
          <Label>GitHub Username</Label>
          <Input
            placeholder="seu-usuario"
            value={settings.github_username}
            onChange={e => onSettingsChange({ ...settings, github_username: e.target.value })}
          />
          <Description className="text-xs">Usado como autor dos commits feitos pelo agente.</Description>
        </TextField>

        <PasswordField
          label="Git PAT"
          value={settings.git_pat}
          placeholder="ghp_..."
          onChange={val => onSettingsChange({ ...settings, git_pat: val })}
        />
      </div>

      {/* ── Repositories — só exibe quando conectado ──────────────────────── */}
      {isConnected && (
        <div className="rounded-xl p-6 flex flex-col gap-4 bg-surface border border-border">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <GitBranch size={18} className="text-muted" />
              <div>
                <h2 className="font-semibold text-foreground">Repositórios</h2>
                <p className="text-xs text-muted mt-0.5">
                  Selecione os repositórios que o agente deve conhecer.
                </p>
              </div>
            </div>
            <button
              onClick={() => refetchRepos()}
              disabled={isLoadingRepos}
              className="p-1.5 rounded-lg transition-colors text-muted hover:text-foreground hover:bg-default disabled:opacity-40"
              title="Atualizar lista"
            >
              <RefreshCw size={15} className={isLoadingRepos ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Loading */}
          {isLoadingRepos && (
            <div className="flex items-center gap-2 py-6 justify-center text-muted">
              <RefreshCw size={15} className="animate-spin" />
              <span className="text-sm">Buscando repositórios...</span>
            </div>
          )}

          {/* Error */}
          {isReposError && !isLoadingRepos && (
            <div className="flex items-center gap-2 py-4 text-danger text-sm">
              <AlertCircle size={15} className="shrink-0" />
              Não foi possível carregar os repositórios. Tente novamente.
            </div>
          )}

          {/* Repo list */}
          {!isLoadingRepos && !isReposError && repos.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={toggleAll}
                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors cursor-pointer
                      ${allSelected ? 'bg-accent border-accent' : someSelected ? 'bg-accent/40 border-accent' : 'border-border bg-surface'}`}
                  >
                    {allSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    {someSelected && <div className="w-2 h-0.5 bg-accent rounded" />}
                  </div>
                  <span className="text-xs text-muted">
                    {selectedCount > 0
                      ? `${selectedCount} de ${repos.length} selecionados`
                      : 'Selecionar todos'
                    }
                  </span>
                </label>

                {notIndexedCount > 0 && (
                  <button
                    onClick={handleIndexSelected}
                    disabled={isIndexing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                  >
                    <Brain size={13} />
                    Indexar {notIndexedCount} {notIndexedCount === 1 ? 'repositório' : 'repositórios'}
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {repos.map(repo => (
                  <RepoRow
                    key={repo.fullName}
                    repo={repo}
                    selected={selectedFullNames.has(repo.fullName)}
                    onToggle={() => toggleRepo(repo.fullName)}
                    indexing={indexingRepos.has(repo.fullName)}
                  />
                ))}
              </div>
            </>
          )}

          {!isLoadingRepos && !isReposError && repos.length === 0 && (
            <p className="text-sm text-muted py-4 text-center">
              Nenhum repositório encontrado para este PAT.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
