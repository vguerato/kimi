import { create } from 'zustand';

interface UIState {
    /** ID da tarefa cujos logs estão sendo visualizados no modal */
    logModalTaskId: string | null;
    openLogModal: (taskId: string) => void;
    closeLogModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    logModalTaskId: null,
    openLogModal: (taskId) => set({ logModalTaskId: taskId }),
    closeLogModal: () => set({ logModalTaskId: null }),
}));
