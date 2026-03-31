import { create } from 'zustand';

interface DetailedSidebarState {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
    setOpen: (value: boolean) => void;
}

export const useDetailedSidebarStore = create<DetailedSidebarState>((set) => ({
    isOpen: false,

    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    setOpen: (value) => set({ isOpen: value }),
}));
