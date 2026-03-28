import { create } from "zustand";

type MediaType = "photo" | "video";

interface MediaPreviewState {
    isOpen: boolean;
    mediaType: MediaType | null;
    mediaUrl: string | null;
    senderUserId: string | null;
    createdAt: string | null;
    openPreview: (mediaType: MediaType, mediaUrl: string, senderUserId: string, createdAt: string) => void;
    closePreview: () => void;
}

const useMediaPreviewStore = create<MediaPreviewState>((set) => ({
    isOpen: false,
    mediaType: null,
    mediaUrl: null,
    senderUserId: null,
    createdAt: null,
    openPreview: (mediaType, mediaUrl, senderUserId, createdAt) =>
        set({ isOpen: true, mediaType, mediaUrl, senderUserId, createdAt }),
    closePreview: () =>
        set({ isOpen: false, mediaType: null, mediaUrl: null, senderUserId: null, createdAt: null }),
}));

export default useMediaPreviewStore;