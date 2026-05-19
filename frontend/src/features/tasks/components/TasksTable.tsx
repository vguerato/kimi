import { Chip } from '@heroui/react';
import { Bot, FileText, RotateCcw, Trash2 } from 'lucide-react';
import { StatusChip } from '@/components/StatusChip';
import type { Task } from '../types';

interface TasksTableProps {
  tasks: Task[];
  onViewLogs: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TasksTable({ tasks, onViewLogs, onRetry, onDelete }: TasksTableProps) {
  return (
    <div className="rounded-xl overflow-hidden bg-surface border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Todas as Tarefas</h2>
        <span className="text-sm text-muted">{tasks.length} tarefa(s)</span>
      </div>

      <div
        className="grid px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted border-b border-border"
        style={{ gridTemplateColumns: '120px 1fr 160px 130px 140px 100px' }}
      >
        <span>ID</span>
        <span>REPO</span>
        <span>MODELO</span>
        <span>STATUS</span>
        <span>DATA</span>
        <span className="text-right">AÇÕES</span>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12 text-sm text-muted">
          Nenhuma tarefa registrada.
        </div>
      )}

      {tasks.map((task) => (
        <div
          key={task.id}
          className="grid px-5 py-3.5 items-center group transition-colors hover:bg-surface-secondary border-b border-border last:border-b-0"
          style={{ gridTemplateColumns: '120px 1fr 160px 130px 140px 100px' }}
        >
          <span className="font-mono text-sm font-bold text-accent">{task.id}</span>

          <div>
            <p className="text-sm font-medium text-foreground">{task.repository}</p>
            <p className="text-xs text-muted truncate">{task.branch}</p>
          </div>

          <div>
            {task.model ? (
              <Chip size="sm" variant="soft" color="secondary">
                <span className="inline-flex items-center gap-1">
                  <Bot size={11} />
                  {task.model}
                </span>
              </Chip>
            ) : (
              <span className="text-muted">—</span>
            )}
          </div>

          <StatusChip status={task.status} />

          <span className="text-xs text-muted">
            {new Date(task.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>

          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onViewLogs(task.id)}
              className="p-1.5 rounded-lg transition-colors text-muted hover:text-accent hover:bg-accent-soft"
              title="Ver logs"
            >
              <FileText size={14} />
            </button>
            <button
              onClick={() => onRetry(task.id)}
              className="p-1.5 rounded-lg transition-colors text-muted hover:text-accent hover:bg-accent-soft"
              title="Reprocessar"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="p-1.5 rounded-lg transition-colors text-muted hover:text-danger hover:bg-danger-soft"
              title="Remover"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
