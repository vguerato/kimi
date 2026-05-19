import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Bell, User, Settings, Save } from 'lucide-react';
import { useGetSettings } from '../api/useGetSettings';
import { useSaveSettings } from '../api/useSaveSettings';
import { IntegracaoTab } from './IntegracaoTab';
import { GitTab } from './GitTab';
import { DEFAULT_SETTINGS, type AppSettings, type SettingsTab } from '../types';
import type { RepoMapping } from '@/features/repositories';

interface SettingsPageProps {
  repoMappings: RepoMapping[];
  onRepoMappingsChange: (mappings: RepoMapping[]) => void;
}

const TABS: Array<{ key: SettingsTab; label: string; path: string }> = [
  { key: 'integracao', label: 'Integração', path: '/settings/integracao' },
  { key: 'git',        label: 'Git',        path: '/settings/git' },
];

// ── Settings Topbar ────────────────────────────────────────────────────────────

function SettingsTopbar({ onBack, onSave, isSaving }: {
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-border bg-surface">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <span className="text-muted select-none">·</span>
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-muted" />
          <span className="font-semibold text-sm text-foreground">Configurações</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-accent text-white hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save size={15} />
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-muted hover:text-foreground hover:bg-default">
          <Bell size={18} />
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-muted bg-default border border-border">
          <User size={18} />
        </button>
      </div>
    </div>
  );
}

// ── Settings Sidebar ───────────────────────────────────────────────────────────

function SettingsSidebar({ visibleTabs }: {
  visibleTabs: Array<{ key: SettingsTab; label: string; path: string }>;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    // overflow-y-auto so the sidebar itself can scroll if tabs overflow
    <aside className="w-52 shrink-0 flex flex-col bg-surface border-r border-border overflow-y-auto">
      <div className="px-4 pt-6 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Configurações
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {visibleTabs.map(tab => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors w-full
                ${isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:text-foreground hover:bg-default'
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function SettingsPage({ repoMappings, onRepoMappingsChange }: SettingsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [localSettings, setLocalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);

  const { data: serverSettings } = useGetSettings();
  const { mutate: saveSettings, isPending: isSaving } = useSaveSettings();

  useEffect(() => {
    if (serverSettings && !initialized) {
      setLocalSettings({ ...DEFAULT_SETTINGS, ...serverSettings });
      setInitialized(true);
    }
  }, [serverSettings, initialized]);

  useEffect(() => {
    if (location.pathname === '/settings' || location.pathname === '/settings/geral') {
      navigate('/settings/integracao', { replace: true });
    }
  }, [location.pathname, navigate]);

  const visibleTabs = TABS;
  const activeTab = (location.pathname.split('/settings/')[1] as SettingsTab) ?? 'integracao';
  const handleSave = () => saveSettings({ settings: localSettings, repoMappings });

  return (
    // flex-1 so this fills the SettingsLayout wrapper (which is flex-col h-full)
    // flex-col so topbar + body stack vertically
    // overflow-hidden so the body area controls its own scroll
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsTopbar
        onBack={() => navigate('/tasks')}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Body: sidebar + scrollable content */}
      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar visibleTabs={visibleTabs} />

        {/* overflow-y-auto here — this is the ONLY scroll container */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {activeTab === 'integracao' && (
            <IntegracaoTab
              settings={localSettings}
              onSettingsChange={setLocalSettings}
            />
          )}
          {activeTab === 'git' && (
            <GitTab
              settings={localSettings}
              onSettingsChange={setLocalSettings}
              repoMappings={repoMappings}
              onRepoMappingsChange={onRepoMappingsChange}
            />
          )}
        </main>
      </div>
    </div>
  );
}
