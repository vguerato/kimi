import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Providers } from './app/Providers';
import { Sidebar } from './app/Sidebar';
import { TasksPage } from '@/features/tasks';
import { RepositoriesPage } from '@/features/repositories';
import { SettingsPage } from '@/features/settings';
import { useRepoMappings } from '@/hooks/useRepoMappings';

// ── Layout with global sidebar (Tasks + Repositories) ─────────────────────────

function MainLayout() {
  const { repoMappings } = useRepoMappings();

  return (
    <div
      className="dark flex h-full overflow-hidden bg-background text-foreground"
      data-theme="dark"
    >
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet context={{ repoMappings }} />
      </main>
    </div>
  );
}

// ── Settings layout (no global sidebar) ───────────────────────────────────────

function SettingsLayout() {
  const { repoMappings, setRepoMappings } = useRepoMappings();

  return (
    // flex + flex-col so SettingsPage can use h-full and flex-1 correctly
    <div
      className="dark flex flex-col h-full bg-background text-foreground"
      data-theme="dark"
    >
      <SettingsPage
        repoMappings={repoMappings}
        onRepoMappingsChange={setRepoMappings}
      />
    </div>
  );
}

// ── Repositories page wrapper ─────────────────────────────────────────────────

function RepositoriesRoute() {
  const { repoMappings } = useRepoMappings();
  return <RepositoriesPage repoMappings={repoMappings} />;
}

// ── Root ──────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <>
      <Toaster theme="dark" position="top-right" richColors closeButton />
      <Routes>
        <Route path="/" element={<Navigate to="/tasks" replace />} />

        <Route element={<MainLayout />}>
          <Route path="/tasks"        element={<TasksPage />} />
          <Route path="/repositories" element={<RepositoriesRoute />} />
        </Route>

        <Route path="/settings/*" element={<SettingsLayout />} />

        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Providers>
      <AppRoutes />
    </Providers>
  );
}
