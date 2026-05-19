import { Chip, Spinner } from '@heroui/react';
import { FileText, Bot, LayoutGrid } from 'lucide-react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  isProcessing?: boolean;
  onViewLogs: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, isProcessing, onViewLogs, onRetry, onDelete }: TaskCardProps) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 bg-surface-secondary border border-border hover:border-border-secondary transition-colors cursor-default">
      <span className="text-xs font-bold font-mono text-accent">{task.id}</span>

      <p className="text-sm font-semibold text-foreground leading-snug">{task.branch}</p>

      <div className="flex flex-wrap gap-1.5">
        {task.model && (
          <Chip size="sm" variant="soft" color="secondary">
            <span className="inline-flex items-center gap-1">
              {isProcessing ? <Spinner size="sm" color="current" /> : <Bot size={11} />}
              {task.model}
            </span>
          </Chip>
        )}
        {task.repository && (
          <Chip size="sm" variant="soft" color="default">
            <span className="inline-flex items-center gap-1">
              <LayoutGrid size={11} />
              {task.repository}
            </span>
          </Chip>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {new Date(task.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        {isProcessing && (
          <button
            onClick={() => onViewLogs(task.id)}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors text-accent bg-accent-soft hover:bg-accent-soft-hover"
          >
            <FileText size={12} />
            Logs
          </button>
        )}
      </div>
    </div>
  );
}
