import { TextField, Label, Input, Description } from '@heroui/react';
import { GitBranch } from 'lucide-react';
import { PasswordField } from '@/components/PasswordField';
import { RepoStatusBadge, useGetRepoStatus } from '@/features/repositories';
import type { RepoMapping } from '@/features/repositories';
import type { AppSettings } from '../types';

interface GitTabProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  repoMappings: RepoMapping[];
  onRepoMappingsChange: (mappings: RepoMapping[]) => void;
}

export function GitTab({ settings, onSettingsChange, repoMappings, onRepoMappingsChange }: GitTabProps) {
  const { data: repoStatus = {} } = useGetRepoStatus();

  const updateMapping = (index: number, field: keyof RepoMapping, value: string) => {
    const updated = [...repoMappings];
    updated[index] = { ...updated[index], [field]: value };
    onRepoMappingsChange(updated);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Credentials ─────────────────────────────────────────────────── */}
      <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
        <div className="flex items-center gap-2.5">
          <GitBranch size={18} className="text-muted" />
          <h2 className="font-semibold text-foreground">Git / GitHub</h2>
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

      {/* ── Repository Mappings ──────────────────────────────────────────── */}
      <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
        <div className="flex items-center gap-2.5">
          <GitBranch size={18} className="text-muted" />
          <h2 className="font-semibold text-foreground">Mapeamento de Repositórios</h2>
        </div>
        <p className="text-xs text-muted">
          Prefixo da tarefa (ex:{' '}
          <code className="px-1 py-0.5 rounded text-xs bg-default text-muted">balance</code>
          ) → URL do repositório Git.
        </p>

        <div className="flex flex-col gap-3">
          {repoMappings.map((m, i) => (
            <div key={i} className="flex gap-3 items-end">
              <TextField className="flex flex-col gap-1 w-1/4">
                {i === 0 && <Label className="text-xs">Prefixo</Label>}
                <Input
                  placeholder="Prefix"
                  value={m.prefix}
                  onChange={e => updateMapping(i, 'prefix', e.target.value)}
                />
              </TextField>
              <TextField className="flex flex-col gap-1 flex-1">
                {i === 0 && <Label className="text-xs">URL do Repositório</Label>}
                <Input
                  placeholder="https://github.com/org/repo.git"
                  value={m.url}
                  onChange={e => updateMapping(i, 'url', e.target.value)}
                />
              </TextField>
              <div className="w-28 shrink-0 flex justify-center pb-0.5">
                {m.prefix && <RepoStatusBadge status={repoStatus[m.prefix]} />}
              </div>
              <button
                onClick={() => onRepoMappingsChange(repoMappings.filter((_, j) => j !== i))}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors text-sm mb-0.5 text-danger bg-danger-soft border border-danger hover:bg-danger-soft-hover"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => onRepoMappingsChange([...repoMappings, { prefix: '', url: '' }])}
          className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-muted bg-default border border-border hover:bg-default-hover"
        >
          + Adicionar Repositório
        </button>
      </div>
    </div>
  );
}
