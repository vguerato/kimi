import { JiraCredentialsCard } from '../jira/components/JiraCredentialsCard';
import { JiraWebhookCard } from '../jira/components/JiraWebhookCard';
import { JiraMappingCard } from '../jira/components/JiraMappingCard';
import type { AppSettings } from '../types';

interface JiraTabProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export function JiraTab({ settings, onSettingsChange }: JiraTabProps) {
  return (
    <div className="flex flex-col gap-5">
      <JiraCredentialsCard settings={settings} onSettingsChange={onSettingsChange} />
      <JiraWebhookCard />
      <JiraMappingCard />
    </div>
  );
}
