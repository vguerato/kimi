import { useState, useEffect } from 'react';
import { Switch } from '@heroui/react';
import { Map, Download, Save } from 'lucide-react';
import { useGetJiraMapping } from '../api/useGetJiraMapping';
import { useLoadJiraConfig } from '../api/useGetJiraConfig';
import { useSaveJiraMapping } from '../api/useSaveJiraMapping';
import { useJiraMappingState } from '../hooks/useJiraMappingState';
import type { JiraConfig } from '../types';

// HeroUI v3 Switch — requires compound structure to render visually
function HeroSwitch({ isSelected, onChange }: {
  isSelected: boolean;
  onChange: () => void;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} size="sm">
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

// ── Status row ─────────────────────────────────────────────────────────────────

function StatusRow({ name, badge, isTrigger, onToggle }: {
  name: string;
  badge?: string;
  isTrigger: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-secondary border border-border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{name}</span>
        {badge && (
          <span className="px-2 py-0.5 rounded-md text-xs bg-default text-muted">{badge}</span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <span className={`text-xs font-medium ${isTrigger ? 'text-success' : 'text-muted'}`}>
          {isTrigger ? 'Gatilho ativo' : 'Ignorar'}
        </span>
        <HeroSwitch isSelected={isTrigger} onChange={onToggle} />
      </div>
    </div>
  );
}

// ── Type row ───────────────────────────────────────────────────────────────────

function TypeRow({ name, isSubtask, isDelegatable, onToggle }: {
  name: string;
  isSubtask?: boolean;
  isDelegatable: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-secondary border border-border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{name}</span>
        {isSubtask !== undefined && (
          <span className="px-2 py-0.5 rounded-md text-xs bg-default text-muted">
            {isSubtask ? 'subtask' : 'issue'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <span className={`text-xs font-medium ${isDelegatable ? 'text-accent' : 'text-muted'}`}>
          {isDelegatable ? 'Delegável' : 'Não delegável'}
        </span>
        <HeroSwitch isSelected={isDelegatable} onChange={onToggle} />
      </div>
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────────────────

export function JiraMappingCard() {
  const { data: mappingData } = useGetJiraMapping();
  const { mutate: loadConfig, isPending: isLoadingConfig } = useLoadJiraConfig();
  const { mutate: saveMapping, isPending: isSaving } = useSaveJiraMapping();

  const [jiraConfig, setJiraConfig] = useState<JiraConfig | null>(null);

  // Auto-load Jira config when a saved mapping exists, so the toggles are
  // visible immediately without requiring the user to click "Carregar do Jira".
  useEffect(() => {
    if (mappingData?.mapping && !jiraConfig) {
      loadConfig(undefined, { onSuccess: data => setJiraConfig(data) });
    }
  }, [mappingData?.mapping]);

  const allStatusNames = jiraConfig?.statuses.map(s => s.name) ?? [];
  const allTypeNames   = jiraConfig?.issueTypes.map(t => t.name) ?? [];

  const { triggerStatuses, delegatableTypes, toggleStatus, toggleType, currentMapping } =
    useJiraMappingState(mappingData?.mapping, allStatusNames, allTypeNames);

  const canSave = triggerStatuses.length > 0 || delegatableTypes.length > 0;

  return (
    <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Map size={18} className="text-muted" />
          <div>
            <h2 className="font-semibold text-foreground">Mapeamento</h2>
            {mappingData?.mapping?.savedAt && (
              <p className="text-xs text-muted">
                Salvo em {new Date(mappingData.mapping.savedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => loadConfig(undefined, { onSuccess: data => setJiraConfig(data) })}
          disabled={isLoadingConfig}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-muted bg-default border border-border hover:bg-default-hover disabled:opacity-50"
        >
          <Download size={14} />
          {isLoadingConfig ? 'Carregando...' : 'Carregar do Jira'}
        </button>
      </div>

      {/* Status section */}
      {allStatusNames.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">STATUS</p>
          {allStatusNames.map(name => (
            <StatusRow
              key={name}
              name={name}
              badge={jiraConfig?.statuses.find(s => s.name === name)?.statusCategory}
              isTrigger={triggerStatuses.includes(name)}
              onToggle={() => toggleStatus(name)}
            />
          ))}
        </div>
      )}

      {/* Issue types section */}
      {allTypeNames.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">TIPOS DE TAREFA</p>
          {allTypeNames.map(name => (
            <TypeRow
              key={name}
              name={name}
              isSubtask={jiraConfig?.issueTypes.find(t => t.name === name)?.subtask}
              isDelegatable={delegatableTypes.includes(name)}
              onToggle={() => toggleType(name)}
            />
          ))}
        </div>
      )}

      {allStatusNames.length === 0 && allTypeNames.length === 0 && (
        <p className="text-xs italic text-muted">
          {isLoadingConfig
            ? 'Carregando configuração do Jira...'
            : 'Clique em Carregar do Jira para buscar os status e tipos disponíveis.'
          }
        </p>
      )}

      {/* Save */}
      <button
        onClick={() => saveMapping(currentMapping)}
        disabled={!canSave || isSaving}
        className={`self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors
          ${canSave
            ? 'bg-accent text-white hover:bg-accent-hover cursor-pointer'
            : 'bg-default text-muted cursor-not-allowed'
          }`}
      >
        <Save size={14} />
        {isSaving ? 'Salvando...' : 'Salvar Mapeamento'}
      </button>
    </div>
  );
}
