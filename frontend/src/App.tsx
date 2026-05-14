import { useState, useEffect, useRef } from 'react';
import { Card, Button } from '@heroui/react';
import { InputGroup, TextField, Label } from '@heroui/react';
import { Toaster, toast } from 'sonner';

// ---- Icons ----
const EyeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeSlashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const RepoIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>;
const TasksIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
const SettingsIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const BotIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>;

// ---- PasswordField ----
function PasswordField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField className="flex flex-col gap-1 w-full">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <InputGroup fullWidth>
        <InputGroup.Input type={visible ? 'text' : 'password'} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        <InputGroup.Suffix>
          <Button size="sm" aria-label="toggle" onPress={() => setVisible(v => !v)} className="bg-transparent border-none shadow-none px-2 text-default-500 hover:text-foreground">
            {visible ? <EyeSlashIcon /> : <EyeIcon />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
    </TextField>
  );
}

// ---- Status Chip ----
// Spinner SVG component
const Spinner = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    className="animate-spin"
  >
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string; spinner?: boolean }> = {
    'em fila':      { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     label: 'Em Fila' },
    'processando':  { color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', label: 'Processando', spinner: true },
    'em espera':    { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label: 'Em Espera' },
    'concluido':    { color: 'bg-green-500/15 text-green-400 border-green-500/30',    label: 'Concluído' },
    'error':        { color: 'bg-red-500/15 text-red-400 border-red-500/30',          label: 'Erro' },
  };
  const { color, label, spinner } = map[status?.toLowerCase()] ?? { color: 'bg-default-100 text-default-500', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {spinner && <Spinner size={11} />}
      {label}
    </span>
  );
}

// ---- PAGES ----

function RepositoriesPage({ repoMappings, repoStatus, setRepoMappings }: any) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Repositórios</h1>
        <p className="text-default-500 text-sm mt-1">Gerencie os repositórios mapeados para delegação de tarefas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {repoMappings.filter((m: any) => m.prefix).map((mapping: any, i: number) => {
          const status = repoStatus[mapping.prefix];
          return (
            <Card key={i} className="p-5 bg-content1 border border-default-100 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><RepoIcon /></div>
                  <div>
                    <p className="font-bold">{mapping.prefix}</p>
                    <p className="text-xs text-default-500 truncate max-w-[180px]">{mapping.url}</p>
                  </div>
                </div>
                {status === 'ready'   && <span className="text-green-500 text-xs font-semibold">✅ Ready</span>}
                {status === 'cloning' && <span className="text-yellow-400 text-xs font-semibold">🔄 Cloning...</span>}
                {status === 'error'   && <span className="text-red-500 text-xs font-semibold">❌ Error</span>}
                {!status              && <span className="text-default-400 text-xs font-semibold">⚪ Pending</span>}
              </div>
              <div className="h-px bg-default-100" />
              <p className="text-xs text-default-400 break-all">{mapping.url || '—'}</p>
            </Card>
          );
        })}

        {repoMappings.filter((m: any) => m.prefix).length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-default-400">
            <RepoIcon />
            <p className="mt-3 text-sm">Nenhum repositório configurado.</p>
            <p className="text-xs">Adicione mapeamentos na página de Configurações.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TasksPage({ tasks, onDelete, onRetry }: { tasks: any[]; onDelete: (id: string) => void; onRetry: (id: string) => void }) {
  const columns = [
    { key: 'em fila',      label: 'Em Fila',       color: 'border-blue-500/40' },
    { key: 'processando',  label: 'Processando',   color: 'border-purple-500/40', showSpinner: true },
    { key: 'em espera',    label: 'Em Espera',     color: 'border-yellow-500/40' },
    { key: 'concluido',    label: 'Concluído',     color: 'border-green-500/40' },
    { key: 'error',        label: 'Erro',           color: 'border-red-500/40' },
  ];

  const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  );

  const RetryIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
    </svg>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <p className="text-default-500 text-sm mt-1">Acompanhe o status das subtarefas delegadas ao agente.</p>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map(col => {
          const colTasks = tasks.filter(t => (t.status || '').toLowerCase() === col.key);
          return (
            <div key={col.key} className={`flex flex-col gap-3 rounded-xl border-t-2 ${col.color} bg-content1/50 p-4`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  {(col as any).showSpinner && colTasks.length > 0 && <Spinner size={13} />}
                  {col.label}
                </span>
                <span className="text-xs text-default-500 bg-default-100 px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {colTasks.map((task: any) => (
                  <Card key={task.id} className="p-3 bg-content1 border border-default-100 flex flex-col gap-2 hover:border-default-300 transition-colors group">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-blue-400">{task.id}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-default-100 text-default-500 px-1.5 py-0.5 rounded">{task.repository}</span>
                        <button
                          onClick={() => onRetry(task.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-default-400 hover:text-blue-400 p-0.5 rounded"
                          title="Reprocessar tarefa"
                        >
                          <RetryIcon />
                        </button>
                        <button
                          onClick={() => onDelete(task.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-default-400 hover:text-red-400 p-0.5 rounded"
                          title="Remover tarefa"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    {task.model && (
                      <span className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/30">
                        🤖 {task.model}
                      </span>
                    )}
                    <p className="text-xs text-default-500 truncate">{task.branch}</p>
                    <p className="text-xs text-default-400">{new Date(task.updated_at).toLocaleString('pt-BR')}</p>
                  </Card>
                ))}
                {colTasks.length === 0 && (
                  <div className="text-center py-6 text-default-300 text-xs">Nenhuma tarefa</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista completa */}
      <Card className="bg-content1 border border-default-100">
        <div className="p-4 border-b border-default-100 flex items-center justify-between">
          <h2 className="font-semibold">Todas as Tarefas</h2>
          <span className="text-xs text-default-400">{tasks.length} tarefa(s)</span>
        </div>
        <div className="divide-y divide-default-100">
          {tasks.length === 0 && (
            <div className="text-center py-10 text-default-400 text-sm">Nenhuma tarefa registrada.</div>
          )}
          {tasks.map((task: any) => (
            <div key={task.id} className="flex items-center justify-between px-4 py-3 hover:bg-default-50 transition-colors group">
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-bold text-blue-400">{task.id}</span>
                <div>
                  <p className="text-sm font-medium">{task.branch}</p>
                  <p className="text-xs text-default-400">Repo: {task.repository} · Parent: {task.parent_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {task.model && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/30">
                    🤖 {task.model}
                  </span>
                )}
                <StatusChip status={task.status} />
                <span className="text-xs text-default-400">{new Date(task.updated_at).toLocaleString('pt-BR')}</span>
                <button
                  onClick={() => onRetry(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-default-400 hover:text-blue-400 p-1.5 rounded hover:bg-blue-400/10"
                  title="Reprocessar tarefa"
                >
                  <RetryIcon />
                </button>
                <button
                  onClick={() => onDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-default-400 hover:text-red-400 p-1.5 rounded hover:bg-red-400/10"
                  title="Remover tarefa"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


function SettingsPage({ settings, setSettings, repoMappings, setRepoMappings, repoStatus, onSave }: any) {
  const [ngrokInfo, setNgrokInfo] = useState<{ url: string | null; webhookUrl: string | null }>({ url: null, webhookUrl: null });

  useEffect(() => {
    fetch('/api/ngrok-url').then(r => r.json()).then(setNgrokInfo).catch(() => {});
  }, []);

  const setupWebhook = () => {
    const id = toast.loading('Registrando webhook no Jira...');
    fetch('/api/jira/setup-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => r.json())
      .then(data => {
        toast.dismiss(id);
        if (data.success) toast.success(`Webhook registrado com sucesso! 🎉\nURL: ${data.webhookUrl}`);
        else toast.error(`Falha ao registrar webhook: ${data.error}`);
      })
      .catch(() => { toast.dismiss(id); toast.error('Erro de comunicação com o backend.'); });
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-default-500 text-sm mt-1">Configure as credenciais do Git e do Jira.</p>
      </div>

      {/* Ngrok / Webhook */}
      <Card className="p-6 bg-content1 border border-default-100 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-green-500/10 text-green-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          </div>
          <h2 className="font-semibold">Webhook / Ngrok</h2>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${ngrokInfo.url ? 'bg-green-500/15 text-green-400' : 'bg-default-100 text-default-400'}`}>
            {ngrokInfo.url ? '🟢 Ativo' : '⚫ Inativo'}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-default-500">URL Pública (Ngrok)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-default-100 rounded-lg px-3 py-2 text-sm text-default-400 truncate">
              {ngrokInfo.webhookUrl ?? 'Ngrok não está ativo. Configure NGROK_AUTHTOKEN no .env'}
            </code>
            {ngrokInfo.webhookUrl && (
              <button
                onClick={() => { navigator.clipboard.writeText(ngrokInfo.webhookUrl!); toast.info('URL copiada!'); }}
                className="shrink-0 text-default-400 hover:text-foreground transition-colors p-2 rounded-lg hover:bg-default-100"
                title="Copiar URL"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* @ts-expect-error HeroUI v3 */}
        <Button color="primary" onPress={setupWebhook} isDisabled={!ngrokInfo.url} className="self-start">
          🔗 Registrar Webhook no Jira Automaticamente
        </Button>
        {!ngrokInfo.url && <p className="text-xs text-default-400">Inicie o servidor com <code className="bg-default-100 px-1 rounded">NGROK_AUTHTOKEN</code> definido para ativar esta função.</p>}
      </Card>

      {/* Git */}
      <Card className="p-6 bg-content1 border border-default-100 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-default-100"><RepoIcon /></div>
          <h2 className="font-semibold">Git / GitHub</h2>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">GitHub Username</label>
          <InputGroup fullWidth>
            <InputGroup.Input placeholder="seu-usuario" value={settings.github_username} onChange={e => setSettings({ ...settings, github_username: e.target.value })} />
          </InputGroup>
          <p className="text-xs text-default-400">Usado como autor dos commits feitos pelo agente.</p>
        </div>
        <PasswordField label="Git PAT" value={settings.git_pat} placeholder="ghp_..." onChange={val => setSettings({ ...settings, git_pat: val })} />
      </Card>

      {/* Jira */}
      <Card className="p-6 bg-content1 border border-default-100 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <h2 className="font-semibold">Jira</h2>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Jira URL</label>
          <InputGroup fullWidth>
            <InputGroup.Input placeholder="https://empresa.atlassian.net" value={settings.jira_url} onChange={e => setSettings({ ...settings, jira_url: e.target.value })} />
          </InputGroup>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Email</label>
          <InputGroup fullWidth>
            <InputGroup.Input placeholder="seu@email.com" value={settings.jira_email} onChange={e => setSettings({ ...settings, jira_email: e.target.value })} />
          </InputGroup>
        </div>
        <PasswordField label="Jira API Token" value={settings.jira_token} placeholder="ATATT..." onChange={val => setSettings({ ...settings, jira_token: val })} />
      </Card>

      {/* Repo Mappings */}
      <Card className="p-6 bg-content1 border border-default-100 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400"><RepoIcon /></div>
          <h2 className="font-semibold">Mapeamento de Repositórios</h2>
        </div>
        <p className="text-xs text-default-500">Prefixo da tarefa (ex: <code className="bg-default-100 px-1 rounded">balance</code>) → URL do repositório Git.</p>

        <div className="flex flex-col gap-2">
          {repoMappings.map((m: any, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <InputGroup className="w-1/4">
                <InputGroup.Input placeholder="Prefix" value={m.prefix} onChange={e => { const u = [...repoMappings]; u[i].prefix = e.target.value; setRepoMappings(u); }} />
              </InputGroup>
              <InputGroup className="flex-1">
                <InputGroup.Input placeholder="https://github.com/org/repo.git" value={m.url} onChange={e => { const u = [...repoMappings]; u[i].url = e.target.value; setRepoMappings(u); }} />
              </InputGroup>
              <div className="w-24 text-center text-xs shrink-0">
                {m.prefix && (repoStatus[m.prefix] === 'ready'   ? <span className="text-green-500">✅ Ready</span>
                            : repoStatus[m.prefix] === 'cloning' ? <span className="text-yellow-400">🔄 Cloning</span>
                            : repoStatus[m.prefix] === 'error'   ? <span className="text-red-500">❌ Error</span>
                            : <span className="text-default-400">⚪ Pending</span>)}
              </div>
              {/* @ts-expect-error HeroUI v3 */}
              <Button size="sm" color="danger" isIconOnly onPress={() => setRepoMappings(repoMappings.filter((_: any, j: number) => j !== i))}>✕</Button>
            </div>
          ))}
        </div>

        {/* @ts-expect-error HeroUI v3 */}
        <Button size="sm" color="secondary" className="self-start" onPress={() => setRepoMappings([...repoMappings, { prefix: '', url: '' }])}>
          + Adicionar Repositório
        </Button>
      </Card>

      {/* @ts-expect-error HeroUI v3 */}
      <Button color="primary" size="lg" onPress={onSave} className="self-start px-8">
        Salvar Configurações
      </Button>
    </div>
  );
}

// ---- MAIN APP ----
type Page = 'repositories' | 'tasks' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('tasks');
  const [tasks, setTasks] = useState<any[]>([]);
  const [settings, setSettings] = useState({ git_pat: '', github_username: '', jira_url: '', jira_email: '', jira_token: '', repo_mappings: '{}' });
  const [repoMappings, setRepoMappings] = useState([{ prefix: '', url: '' }]);
  const [repoStatus, setRepoStatus] = useState<Record<string, string>>({});
  const prevRepoStatus = useRef<Record<string, string>>({});

  // Initial load
  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(setTasks).catch(() => {});
    fetch('/api/settings').then(r => r.json()).then(data => {
      setSettings({ git_pat: data.git_pat || '', github_username: data.github_username || '', jira_url: data.jira_url || '', jira_email: data.jira_email || '', jira_token: data.jira_token || '', repo_mappings: data.repo_mappings || '{}' });
      try {
        const parsed = JSON.parse(data.repo_mappings || '{}');
        const entries = Object.entries(parsed).map(([prefix, url]) => ({ prefix, url: String(url) }));
        if (entries.length > 0) setRepoMappings(entries);
      } catch {}
    }).catch(() => {});
  }, []);

  // Poll tasks and repo status
  useEffect(() => {
    const iv = setInterval(() => {
      fetch('/api/tasks').then(r => r.json()).then(setTasks).catch(() => {});
      fetch('/api/repos/status').then(r => r.json()).then((data: Record<string, string>) => {
        for (const [prefix, status] of Object.entries(data)) {
          const prev = prevRepoStatus.current[prefix];
          if (prev === 'cloning' && status === 'ready') toast.success(`Repositório "${prefix}" clonado com sucesso! ✅`);
          if (prev === 'cloning' && status === 'error')  toast.error(`Erro ao clonar "${prefix}". Verifique a URL e o Git PAT.`);
        }
        prevRepoStatus.current = data;
        setRepoStatus(data);
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  const saveSettings = () => {
    const mappingObj = repoMappings.reduce((acc: any, m) => { if (m.prefix && m.url) acc[m.prefix] = m.url; return acc; }, {});
    const payload = { ...settings, repo_mappings: JSON.stringify(mappingObj) };
    const id = toast.loading('Salvando...');
    fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(r => r.json())
      .then(data => {
        toast.dismiss(id);
        toast.success('Configurações salvas!');
        if (data.jiraValid === true)  toast.success('Credenciais do Jira validadas! 🎉');
        if (data.jiraValid === false) toast.error('Credenciais do Jira inválidas. Verifique URL, Email e Token.');
        if (repoMappings.some(m => m.prefix && m.url)) toast.info('Sincronizando repositórios em segundo plano...');
      })
      .catch(() => { toast.dismiss(id); toast.error('Erro ao salvar!'); });
  };

  const deleteTask = (taskId: string) => {
    fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setTasks(prev => prev.filter((t: any) => t.id !== taskId));
          toast.success(`Tarefa ${taskId} removida.`);
        } else {
          toast.error(`Erro ao remover tarefa: ${data.error}`);
        }
      })
      .catch(() => toast.error('Erro de comunicação ao remover tarefa.'));
  };

  const retryTask = (taskId: string) => {
    fetch(`/api/tasks/${encodeURIComponent(taskId)}/retry`, { method: 'POST' })
      .then(async r => {
        const data = await r.json();
        if (r.status === 409) {
          toast.warning(`⏳ ${data.error}`);
          return;
        }
        if (data.success) {
          setTasks(prev => prev.map((t: any) => t.id === taskId ? { ...t, status: 'em fila' } : t));
          toast.success(`Tarefa ${taskId} reenviada para reprocessamento! 🔄`);
        } else {
          toast.error(`Erro ao reprocessar: ${data.error}`);
        }
      })
      .catch(() => toast.error('Erro de comunicação ao reprocessar tarefa.'));
  };

  const navItems: { key: Page; label: string; icon: React.ReactNode }[] = [
    { key: 'repositories', label: 'Repositórios', icon: <RepoIcon /> },
    { key: 'tasks',        label: 'Tarefas',       icon: <TasksIcon /> },
    { key: 'settings',     label: 'Configurações', icon: <SettingsIcon /> },
  ];

  return (
    <div className="dark text-foreground bg-background min-h-screen flex">
      <Toaster theme="dark" position="top-right" richColors closeButton />

      {/* Sidebar */}
      <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-content1 border-r border-default-100">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-default-100">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <BotIcon />
          </div>
          <div>
            <p className="font-bold text-sm">Kiro AI</p>
            <p className="text-xs text-default-400">Task Delegator</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-left
                ${page === item.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-default-500 hover:text-foreground hover:bg-default-100'}`}
            >
              <span className={page === item.key ? 'text-primary' : 'text-default-400'}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer badge */}
        <div className="p-4 border-t border-default-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-default-400">Worker</span>
            <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Active
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-default-400">Tarefas</span>
            <span className="text-xs text-default-500">{tasks.length} total</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {page === 'repositories' && <RepositoriesPage repoMappings={repoMappings} repoStatus={repoStatus} setRepoMappings={setRepoMappings} />}
          {page === 'tasks'        && <TasksPage tasks={tasks} onDelete={deleteTask} onRetry={retryTask} />}
          {page === 'settings'     && <SettingsPage settings={settings} setSettings={setSettings} repoMappings={repoMappings} setRepoMappings={setRepoMappings} repoStatus={repoStatus} onSave={saveSettings} />}
        </div>
      </main>
    </div>
  );
}
