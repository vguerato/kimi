import { TextField, Label, Input } from '@heroui/react';
import { Monitor } from 'lucide-react';
import { PasswordField } from '@/components/PasswordField';
import type { AppSettings } from '@/features/settings/types';

interface JiraCredentialsCardProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function JiraCredentialsCard({ settings, onSettingsChange }: JiraCredentialsCardProps) {
  return (
    <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
      <div className="flex items-center gap-2.5">
        <Monitor size={18} className="text-muted" />
        <h2 className="font-semibold text-foreground">Credenciais</h2>
      </div>

      <TextField className="flex flex-col gap-1.5 w-full">
        <Label>Jira URL</Label>
        <Input
          placeholder="https://empresa.atlassian.net"
          value={settings.jira_url}
          onChange={e => onSettingsChange({ ...settings, jira_url: e.target.value })}
        />
      </TextField>

      <TextField className="flex flex-col gap-1.5 w-full">
        <Label>Email</Label>
        <Input
          type="email"
          placeholder="engenheiro@empresa.com"
          value={settings.jira_email}
          onChange={e => onSettingsChange({ ...settings, jira_email: e.target.value })}
        />
      </TextField>

      <PasswordField
        label="API Token"
        value={settings.jira_token}
        placeholder="ATATT..."
        description="Necessário para ler tarefas e atualizar status no Jira."
        onChange={val => onSettingsChange({ ...settings, jira_token: val })}
      />
    </div>
  );
}
