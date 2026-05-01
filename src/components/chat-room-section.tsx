"use client";

import React, { useEffect } from "react";
import { useMediaAttachmentStore } from "@/store/media-attachment-store";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import ChatRoomHeader from "./chat-room-header";
import ChatRoomContent from "./chat-room-content";
import MediaAttachmentContainer from "./media-attachment-container";

export default function ChatRoomSection() {
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const attachment = useMediaAttachmentStore((state) => state.attachment);
    const clearMediaAttachment = useMediaAttachmentStore(
        (state) => state.clearMediaAttachment
    );

    useEffect(() => {
        if (attachment && attachment.chatId !== selectedChatId) {
            clearMediaAttachment();
        }
    }, [attachment, clearMediaAttachment, selectedChatId]);

    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            <ChatRoomHeader />
            {attachment ? <MediaAttachmentContainer /> : <ChatRoomContent />}
        </div>
    );
}
