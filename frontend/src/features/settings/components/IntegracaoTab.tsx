import { Check } from 'lucide-react';
import type { AppSettings } from '../types';

interface IntegracaoTabProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

const PROVIDERS = [
  { value: 'jira',         label: 'Jira',         sub: 'Atlassian', icon: '🟦', available: true },
  { value: 'azure-devops', label: 'Azure DevOps', sub: 'Microsoft', icon: '🔷', available: false },
];

export function IntegracaoTab({ settings, onSettingsChange }: IntegracaoTabProps) {
  const currentProvider = settings.project_manager ?? 'jira';

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
        <div>
          <h2 className="font-semibold text-foreground">Gerenciador de Projetos</h2>
          <p className="text-xs mt-1 text-muted">
            Selecione a plataforma de gerenciamento de tarefas integrada ao agente.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map(opt => {
            const isSelected = currentProvider === opt.value;
            return (
              <button
                key={opt.value}
                disabled={!opt.available}
                onClick={() => { if (opt.available) onSettingsChange({ ...settings, project_manager: opt.value }); }}
                className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all border-2
                  ${isSelected ? 'border-accent bg-accent-soft' : 'border-border bg-surface-secondary hover:border-border-secondary'}
                  ${!opt.available ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted">
                    {opt.available ? opt.sub : `${opt.sub} · Em breve`}
                  </p>
                </div>
                {isSelected && <Check size={14} className="text-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
