import { NavLink } from 'react-router-dom';
import { GitBranch, FileText, Settings } from 'lucide-react';
import { useGetTasks } from '@/features/tasks';

const NAV_ITEMS = [
  { to: '/repositories', label: 'Repositórios', icon: <GitBranch size={16} /> },
  { to: '/tasks',        label: 'Tarefas',       icon: <FileText size={16} /> },
  { to: '/settings',     label: 'Configurações', icon: <Settings size={16} /> },
];

export function Sidebar() {
  const { data: tasks = [] } = useGetTasks();
  const queuedCount = tasks.filter(t => t.status === 'em fila').length;

  return (
    <aside className="w-[190px] shrink-0 h-screen sticky top-0 flex flex-col bg-surface border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm bg-gradient-to-br from-accent to-secondary">
          K
        </div>
        <div>
          <p className="font-bold text-sm text-foreground leading-tight">Kiro AI</p>
          <p className="text-[11px] leading-tight text-muted">Task Delegator</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1 mt-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left no-underline
              ${isActive
                ? 'bg-accent-soft text-accent'
                : 'text-muted hover:text-foreground hover:bg-default'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-accent' : 'text-muted'}>
                  {item.icon}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            <span className="text-xs font-medium text-foreground">Worker</span>
          </div>
          <span className="text-xs font-semibold text-success">Active</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-muted">Tarefas em fila</span>
          <span className="text-xs font-semibold text-foreground">{queuedCount}</span>
        </div>
      </div>
    </aside>
  );
}
