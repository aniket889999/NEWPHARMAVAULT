import { create } from 'zustand';

interface UiState {
  isSidebarOpen: boolean;
  isLoading: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setLoading: (status: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  isLoading: false,
  theme: 'system',
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setLoading: (status) => set({ isLoading: status }),
  setTheme: (theme) => set({ theme }),
}));
