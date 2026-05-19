import { useState, useEffect, useRef } from 'react';
import { FileText, X, AlertCircle, Wrench, Info, AlignLeft, ArrowDown } from 'lucide-react';

interface LogEntry {
  ts: string;
  level: string;
  message: string;
}

interface LogModalProps {
  taskId: string;
  taskStatus: string;
  onClose: () => void;
}

const FINISHED_STATUSES = new Set(['em espera', 'concluido', 'error']);

function LevelIcon({ level }: { level: string }) {
  if (level === 'error')  return <AlertCircle size={14} className="text-danger shrink-0" />;
  if (level === 'tool')   return <Wrench size={14} className="text-accent shrink-0" />;
  if (level === 'system') return <Info size={14} className="text-warning shrink-0" />;
  return <Info size={14} className="text-muted shrink-0" />;
}

function levelTextClass(level: string): string {
  if (level === 'error')  return 'text-danger';
  if (level === 'tool')   return 'text-foreground';
  if (level === 'system') return 'text-foreground';
  return 'text-muted';
}

export function LogModal({ taskId, taskStatus, onClose }: LogModalProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  const isFinished = isDone || FINISHED_STATUSES.has(taskStatus);

  useEffect(() => {
    const es = new EventSource(`/api/tasks/${encodeURIComponent(taskId)}/logs/stream`);
    setIsConnected(true);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'history') setEntries(msg.entries ?? []);
        else if (msg.type === 'log') setEntries(prev => [...prev, msg.entry]);
        else if (msg.type === 'done') { setIsDone(true); es.close(); setIsConnected(false); }
      } catch { /* ignore */ }
    };
    es.onerror = () => { setIsConnected(false); es.close(); };
    return () => { es.close(); setIsConnected(false); };
  }, [taskId]);

  useEffect(() => {
    if (autoScroll.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-overlay backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-surface border border-border"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-soft">
              <FileText size={16} className="text-accent" />
            </div>
            <span className="font-semibold text-foreground">Execution Logs</span>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-default text-muted">
              Task {taskId}
            </span>
            {isConnected && !isFinished && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
                Ao vivo
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors text-muted hover:text-foreground hover:bg-default"
          >
            <X size={18} />
          </button>
        </div>

        {/* Terminal body */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 font-mono text-xs leading-relaxed bg-background"
          onScroll={e => {
            const el = e.currentTarget;
            autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {entries.length === 0 && (
            <p className="italic text-muted">
              {isFinished ? 'Nenhum log registrado para esta tarefa.' : 'Aguardando logs...'}
            </p>
          )}
          {entries.map((entry, i) => {
            const isError = entry.level === 'error';
            return (
              <div
                key={i}
                className={`flex gap-3 mb-1 rounded-lg ${isError ? 'bg-danger-soft border border-danger px-2 py-1.5' : 'px-0 py-px'}`}
              >
                <span className="shrink-0 select-none text-muted min-w-[160px]">
                  [{new Date(entry.ts).toLocaleString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '')}]
                </span>
                <LevelIcon level={entry.level} />
                <span className={`whitespace-pre-wrap break-all flex-1 ${levelTextClass(entry.level)}`}>
                  {entry.message}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-t border-border">
          <div className="flex items-center gap-1.5 text-muted">
            <AlignLeft size={13} />
            <span className="text-xs">{entries.length} lines</span>
          </div>
          <button
            onClick={() => { autoScroll.current = true; bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors text-muted bg-default border border-border hover:bg-default-hover"
          >
            <ArrowDown size={12} />
            Scroll to bottom
          </button>
        </div>
      </div>
    </div>
  );
}
