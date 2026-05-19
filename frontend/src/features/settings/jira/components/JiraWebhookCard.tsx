import { toast } from 'sonner';
import { Link2, Copy, RefreshCw } from 'lucide-react';
import { useGetNgrokInfo } from '../api/useGetNgrokInfo';
import { useSetupWebhook } from '../api/useSetupWebhook';

export function JiraWebhookCard() {
  const { data: ngrokInfo = { url: null, webhookUrl: null } } = useGetNgrokInfo();
  const { mutate: setupWebhook, isPending } = useSetupWebhook();
  const isActive = !!ngrokInfo.url;

  return (
    <div className="rounded-xl p-6 flex flex-col gap-5 bg-surface border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link2 size={18} className="text-muted" />
          <h2 className="font-semibold text-foreground">Webhook / Ngrok</h2>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-success-soft text-success' : 'bg-default text-muted'}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${isActive ? 'bg-success' : 'bg-default-400'}`} />
          {isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted">URL Pública (Ngrok)</label>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-surface-secondary border border-border">
          <span className={`flex-1 text-sm truncate ${ngrokInfo.webhookUrl ? 'text-foreground' : 'text-muted'}`}>
            {ngrokInfo.webhookUrl ?? 'Ngrok não está ativo. Configure NGROK_AUTHTOKEN no .env'}
          </span>
          {ngrokInfo.webhookUrl && (
            <button
              onClick={() => { navigator.clipboard.writeText(ngrokInfo.webhookUrl!); toast.info('URL copiada!'); }}
              className="shrink-0 p-1 rounded transition-colors text-muted hover:text-foreground"
            >
              <Copy size={15} />
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => setupWebhook()}
        disabled={!isActive || isPending}
        className={`self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
          ${isActive
            ? 'bg-accent-soft text-accent hover:bg-accent-soft-hover border border-accent'
            : 'bg-default text-muted border border-border cursor-not-allowed'
          }`}
      >
        <RefreshCw size={14} />
        Registrar Webhook
      </button>
    </div>
  );
}
