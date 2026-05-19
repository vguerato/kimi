import { Check } from 'lucide-react';
import { ProviderCredentialsCard } from './pm/ProviderCredentialsCard';
import { ProviderWebhookCard } from './pm/ProviderWebhookCard';
import { ProviderMappingCard } from './pm/ProviderMappingCard';
import type { AppSettings } from '../types';

interface IntegracaoTabProps {
    settings: AppSettings;
    onSettingsChange: (settings: AppSettings) => void;
}

// ── Logos ──────────────────────────────────────────────────────────────────────

function JiraLogo({ size = 32 }: { size?: number }) {
    // Extracted from jira.svg — only the icon portion (blue square + symbol),
    // cropped to the 75×75 icon area (left portion of the full logo SVG).
    return (
        <svg width={size} height={size} viewBox="0 0 75 75" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="75" height="75" rx="18.75" fill="#1868DB" />
            <path
                d="M28.0429 48.5103H23.817C17.4434 48.5103 12.8711 44.6064 12.8711 38.89H35.5942C36.772 38.89 37.534 39.7265 37.534 40.9116V63.7773C31.8532 63.7773 28.0429 59.1763 28.0429 52.7628V48.5103Z"
                fill="white"
            />
            <path
                d="M39.266 37.1472H35.04C28.6664 37.1472 24.0941 33.313 24.0941 27.5965H46.8172C47.995 27.5965 48.8263 28.3634 48.8263 29.5485V52.4142C43.1455 52.4142 39.266 47.8132 39.266 41.3996V37.1472Z"
                fill="white"
            />
            <path
                d="M50.5582 25.8537H46.3323C39.9587 25.8537 35.3864 21.9498 35.3864 16.2334H58.1095C59.2873 16.2334 60.0493 17.0699 60.0493 18.1853V41.0511C54.3685 41.0511 50.5582 36.45 50.5582 30.0365V25.8537Z"
                fill="white"
            />
        </svg>
    );
}

function AzureDevOpsLogo({ size = 32 }: { size?: number }) {
    // Extracted from azure-devops.svg — viewBox 0 0 18 18 with gradient
    return (
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="azure-grad" x1="9" y1="16.97" x2="9" y2="1.03" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#0078d4" />
                    <stop offset="0.16" stopColor="#1380da" />
                    <stop offset="0.53" stopColor="#3c91e5" />
                    <stop offset="0.82" stopColor="#559cec" />
                    <stop offset="1" stopColor="#5ea0ef" />
                </linearGradient>
            </defs>
            <path
                d="M17,4v9.74l-4,3.28-6.2-2.26V17L3.29,12.41l10.23.8V4.44Zm-3.41.49L7.85,1V3.29L2.58,4.84,1,6.87v4.61l2.26,1V6.57Z"
                fill="url(#azure-grad)"
            />
        </svg>
    );
}

const PROVIDER_LOGOS: Record<string, React.FC<{ size?: number }>> = {
    'jira': JiraLogo,
    'azure-devops': AzureDevOpsLogo,
};

const PROVIDERS = [
    { value: 'jira',         label: 'Jira',         sub: 'Atlassian' },
    { value: 'azure-devops', label: 'Azure DevOps', sub: 'Microsoft' },
];

// ── Provider selector ──────────────────────────────────────────────────────────

function ProviderSelector({ current, onChange }: {
    current: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
            <div>
                <h2 className="font-semibold text-foreground">Gerenciador de Projetos</h2>
                <p className="text-xs mt-1 text-muted">
                    Selecione a plataforma de gerenciamento de tarefas integrada ao agente.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map(opt => {
                    const isSelected = current === opt.value;
                    const Logo = PROVIDER_LOGOS[opt.value];
                    return (
                        <button
                            key={opt.value}
                            onClick={() => onChange(opt.value)}
                            className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all border-2 cursor-pointer
                                ${isSelected
                                    ? 'border-accent bg-accent-soft'
                                    : 'border-border bg-surface-secondary hover:border-border-secondary'
                                }`}
                        >
                            <Logo size={32} />
                            <div className="flex-1">
                                <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                                <p className="text-xs text-muted">{opt.sub}</p>
                            </div>
                            {isSelected && <Check size={14} className="text-accent" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export function IntegracaoTab({ settings, onSettingsChange }: IntegracaoTabProps) {
    const currentProvider = settings.project_manager ?? 'jira';

    return (
        <div className="flex flex-col gap-5">
            {/* 1. Provider selector */}
            <ProviderSelector
                current={currentProvider}
                onChange={value => onSettingsChange({ ...settings, project_manager: value })}
            />

            {/* 2. Provider-specific configuration */}
            <ProviderCredentialsCard
                provider={currentProvider}
                settings={settings}
                onSettingsChange={onSettingsChange}
            />

            <ProviderWebhookCard provider={currentProvider} />

            <ProviderMappingCard provider={currentProvider} />
        </div>
    );
}
