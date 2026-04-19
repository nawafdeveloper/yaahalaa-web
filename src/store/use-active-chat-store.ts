import { create } from "zustand";

interface ActiveChatState {
    /** Phone number of the user the current chat room is open with. */
    recipientPhone: string | null;
    setRecipientPhone: (phone: string | null) => void;
    reset: () => void;
}

export const useActiveChatStore = create<ActiveChatState>((set) => ({
    recipientPhone: null,
    setRecipientPhone: (phone) => set({ recipientPhone: phone }),
    reset: () => set({ recipientPhone: null }),
}));
