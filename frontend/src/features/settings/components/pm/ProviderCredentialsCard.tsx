import { TextField, Label, Input } from '@heroui/react';
import { KeyRound } from 'lucide-react';
import { PasswordField } from '@/components/PasswordField';
import type { AppSettings } from '../../types';

interface ProviderCredentialsCardProps {
    provider: string;
    settings: AppSettings;
    onSettingsChange: (s: AppSettings) => void;
}

// ── Jira fields ────────────────────────────────────────────────────────────────

function JiraFields({ settings, onSettingsChange }: Omit<ProviderCredentialsCardProps, 'provider'>) {
    return (
        <>
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
        </>
    );
}

// ── Azure DevOps fields ────────────────────────────────────────────────────────

function AzureFields({ settings, onSettingsChange }: Omit<ProviderCredentialsCardProps, 'provider'>) {
    return (
        <>
            <TextField className="flex flex-col gap-1.5 w-full">
                <Label>Organização</Label>
                <Input
                    placeholder="minha-org"
                    value={settings.azure_devops_org}
                    onChange={e => onSettingsChange({ ...settings, azure_devops_org: e.target.value })}
                />
            </TextField>

            <TextField className="flex flex-col gap-1.5 w-full">
                <Label>Projeto</Label>
                <Input
                    placeholder="MeuProjeto"
                    value={settings.azure_devops_project}
                    onChange={e => onSettingsChange({ ...settings, azure_devops_project: e.target.value })}
                />
            </TextField>

            <PasswordField
                label="Personal Access Token (PAT)"
                value={settings.azure_devops_token}
                placeholder="PAT..."
                description="Necessário para ler work items e atualizar status no Azure DevOps."
                onChange={val => onSettingsChange({ ...settings, azure_devops_token: val })}
            />
        </>
    );
}

// ── Card ───────────────────────────────────────────────────────────────────────

export function ProviderCredentialsCard({ provider, settings, onSettingsChange }: ProviderCredentialsCardProps) {
    return (
        <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
            <div className="flex items-center gap-2.5">
                <KeyRound size={18} className="text-muted" />
                <h2 className="font-semibold text-foreground">Credenciais</h2>
            </div>

            {provider === 'jira' && (
                <JiraFields settings={settings} onSettingsChange={onSettingsChange} />
            )}
            {provider === 'azure-devops' && (
                <AzureFields settings={settings} onSettingsChange={onSettingsChange} />
            )}
        </div>
    );
}
