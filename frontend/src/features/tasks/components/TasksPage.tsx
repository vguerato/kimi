import { useState } from 'react';
import { useGetTasks } from '../api/useGetTasks';
import { useDeleteTask } from '../api/useDeleteTask';
import { useRetryTask } from '../api/useRetryTask';
import { useUIStore } from '@/stores/uiStore';
import { KanbanBoard } from './KanbanBoard';
import { TasksTable } from './TasksTable';
import { LogModal } from './LogModal';
import { Topbar } from '@/app/Topbar';

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export function TasksPage() {
  const { data: tasks = [] } = useGetTasks();
  const { mutate: deleteTask } = useDeleteTask();
  const { mutate: retryTask } = useRetryTask();
  const { logModalTaskId, openLogModal, closeLogModal } = useUIStore();
  const [search, setSearch] = useState('');

  const logTask = tasks.find((t) => t.id === logModalTaskId);
  const filtered = search
    ? tasks.filter(t =>
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.branch.toLowerCase().includes(search.toLowerCase()) ||
        (t.repository || '').toLowerCase().includes(search.toLowerCase())
      )
    : tasks;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        searchPlaceholder="Pesquisar tarefas..."
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-sm mt-1 text-muted">
            Acompanhe o status das subtarefas delegadas ao agente.
          </p>
        </div>

        {/* Kanban */}
        <KanbanBoard
          tasks={filtered}
          onViewLogs={openLogModal}
          onRetry={retryTask}
          onDelete={deleteTask}
        />

        {/* Table */}
        <TasksTable
          tasks={filtered}
          onViewLogs={openLogModal}
          onRetry={retryTask}
          onDelete={deleteTask}
        />
      </div>

      {/* Log modal */}
      {logModalTaskId && logTask && (
        <LogModal
          taskId={logModalTaskId}
          taskStatus={logTask.status}
          onClose={closeLogModal}
        />
      )}
    </div>
  );
}
