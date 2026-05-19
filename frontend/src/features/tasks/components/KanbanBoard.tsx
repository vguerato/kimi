import { Spinner } from '@heroui/react';
import { Hourglass } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { Task } from '../types';

interface KanbanColumn {
  key: string;
  label: string;
  showSpinner?: boolean;
}

const COLUMNS: KanbanColumn[] = [
  { key: 'em fila',     label: 'Em Fila' },
  { key: 'processando', label: 'Processando', showSpinner: true },
  { key: 'em espera',   label: 'Em Espera' },
  { key: 'concluido',   label: 'Concluído' },
];

interface KanbanBoardProps {
  tasks: Task[];
  onViewLogs: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

export function KanbanBoard({ tasks, onViewLogs, onRetry, onDelete }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => (t.status || '').toLowerCase() === col.key);
        return (
          <div key={col.key} className="flex flex-col gap-3 rounded-xl p-4 bg-surface border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                {col.showSpinner && colTasks.length > 0 && <Spinner size="sm" color="secondary" />}
                {col.label}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-default text-muted">
                {colTasks.length}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {colTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isProcessing={col.key === 'processando'}
                  onViewLogs={onViewLogs}
                  onRetry={onRetry}
                  onDelete={onDelete}
                />
              ))}
              {colTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Hourglass size={28} className="text-muted" />
                  <p className="text-xs text-muted">
                    Nenhuma tarefa em {col.label.toLowerCase()}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
