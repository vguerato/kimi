export type TaskStatus = 'em fila' | 'processando' | 'em espera' | 'concluido' | 'error';

export interface Task {
    id: string;
    parent_id: string | null;
    title: string | null;
    description: string | null;
    status: TaskStatus;
    repository: string;
    branch: string;
    model: string | null;
    commit_url: string | null;
    logs: string | null;
    created_at: string;
    updated_at: string;
}
