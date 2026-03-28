// store/use-settings-store.ts
import { create } from 'zustand';

export type SettingsSection =
    | 'settings-main'
    | 'settings-general'
    | 'settings-profile'
    | 'settings-account'
    | 'settings-privacy'
    | 'settings-chats'
    | 'settings-notifications'
    | 'settings-help';

interface SettingsStore {
    activeSettingsSection: SettingsSection;
    setActiveSettingsSection: (section: SettingsSection) => void;
    navigateToSettings: (href: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    activeSettingsSection: 'settings-main',

    setActiveSettingsSection: (section) => set({ activeSettingsSection: section }),

    navigateToSettings: (href) => {
         const section = href as SettingsSection;
        set({ activeSettingsSection: section });
    }
}));