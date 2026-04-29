"use client";

import { authClient } from "@/lib/auth-client";
import {
    createOptimisticMessage,
    decryptMessageBatch,
    encryptTextForRecipients,
} from "@/lib/chat-e2ee";
import { buildChatFromMessage } from "@/lib/chat-utils";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useRealtimeStore } from "@/store/use-realtime-store";
import { normalizeMessage } from "@/lib/chat-utils";
import type { Message } from "@/types/messages.type";
import type { ClientRealtimeEvent } from "@/types/realtime-events";

const ACK_TIMEOUT_MS = 800;

export function useSendChatMessage() {
    const { data: session } = authClient.useSession();
    const chats = useActiveChatStore((state) => state.chats);
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const recipientPhone = useActiveChatStore((state) => state.recipientPhone);
    const appendMessage = useActiveChatStore((state) => state.appendMessage);
    const updateMessage = useActiveChatStore((state) => state.updateMessage);
    const upsertChat = useActiveChatStore((state) => state.upsertChat);
    const setDraft = useActiveChatStore((state) => state.setDraft);
    const sendRealtimeEvent = useRealtimeStore((state) => state.sendEvent);

    const sendMessage = async ({
        text,
        chatId = selectedChatId,
        clearDraft = true,
        existingMessageId,
    }: {
        text: string;
        chatId?: string | null;
        clearDraft?: boolean;
        existingMessageId?: string;
    }) => {
        const trimmed = text.trim();
        const currentUserId = session?.user.id;
        const currentPhone = (session?.user as { phoneNumber?: string | null } | undefined)
            ?.phoneNumber;
        const currentPublicKey = (session?.user as { yhlaPublicKey?: string | null } | undefined)
            ?.yhlaPublicKey;

        if (!trimmed || !chatId || !currentUserId || !currentPhone || !currentPublicKey) {
            return false;
        }

        const selectedChat = chats.find((chat) => chat.chat_id === chatId) ?? null;
        if (!selectedChat) {
            return false;
        }

        const recipientUserId = selectedChat.recipient_user_id ?? undefined;
        const recipientPublicKey = selectedChat.recipient_public_key ?? undefined;
        const conversationType: "group" | "direct" =
            selectedChat.chat_type === "group" ? "group" : "direct";
        const messageId = existingMessageId ?? crypto.randomUUID();
        const optimisticMessage = createOptimisticMessage({
            messageId,
            chatId,
            senderUserId: currentUserId,
            plaintext: trimmed,
        });

        if (!existingMessageId) {
            appendMessage(chatId, optimisticMessage);
        } else {
            updateMessage(chatId, existingMessageId, (message) => ({
                ...message,
                client_status: "sending",
                client_error: null,
            }));
        }

        upsertChat(
            buildChatFromMessage({
                conversationId: chatId,
                conversationType,
                message: optimisticMessage,
                currentUserId,
                unreadCount: 0,
                fallbackExistingChat: selectedChat,
            })
        );

        if (clearDraft) {
            setDraft(chatId, "");
        }

        try {
            const recipients = [
                {
                    userId: currentUserId,
                    publicKey: currentPublicKey,
                },
                recipientUserId && recipientPublicKey
                    ? {
                          userId: recipientUserId,
                          publicKey: recipientPublicKey,
                      }
                    : null,
            ].filter(Boolean) as { userId: string; publicKey: string }[];

            const encryptedMessage = await encryptTextForRecipients(trimmed, recipients);
            const encryptedPreview = await encryptTextForRecipients(trimmed, recipients);

            const payload: Extract<
                ClientRealtimeEvent,
                { type: "SEND_MESSAGE" }
            > = {
                type: "SEND_MESSAGE" as const,
                clientMessageId: messageId,
                conversationId: chatId,
                conversationType,
                senderUserId: currentUserId,
                senderNickname: session.user.name ?? currentPhone,
                senderPhone: currentPhone,
                recipientUserId,
                recipientPhone: recipientPhone ?? selectedChat.contact_phone ?? undefined,
                encryptedContent: encryptedMessage.encryptedContent,
                recipientEncryptionKeys: encryptedMessage.recipientEncryptionKeys,
                encryptedChatPreview: encryptedPreview.encryptedContent,
                chatPreviewRecipientKeys: encryptedPreview.recipientEncryptionKeys,
            };
            const httpPayload = {
                clientMessageId: messageId,
                senderUserId: currentUserId,
                senderNickname: session.user.name ?? currentPhone,
                chatRoomId: chatId,
                conversationType,
                senderPhone: currentPhone,
                recipientPhone:
                    recipientPhone ?? selectedChat.contact_phone ?? undefined,
                messageTextContent: trimmed,
                encryptedContent: encryptedMessage.encryptedContent,
                recipientEncryptionKeys: encryptedMessage.recipientEncryptionKeys,
                encryptedChatPreview: encryptedPreview.encryptedContent,
                chatPreviewRecipientKeys: encryptedPreview.recipientEncryptionKeys,
            };

            const realtimeSent = sendRealtimeEvent(payload);

            if (!realtimeSent) {
                const response = await fetch("/api/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(httpPayload),
                });

                if (!response.ok) {
                    throw new Error("Failed to send message");
                }

                const result = (await response.json()) as {
                    message: Parameters<typeof normalizeMessage>[0];
                };

                const nextMessage = normalizeMessage(result.message);
                updateMessage(chatId, messageId, () => ({
                    ...nextMessage,
                    message_text_content: trimmed,
                    client_status: "sent",
                    client_error: null,
                }));
            } else {
                void reconcilePendingMessage({
                    chatId,
                    currentUserId,
                    fallbackText: trimmed,
                    httpPayload,
                    messageId,
                    updateMessage,
                });
            }

            return true;
        } catch (error) {
            updateMessage(chatId, messageId, (message) => ({
                ...message,
                client_status: "failed",
                client_error:
                    error instanceof Error ? error.message : "Failed to send message",
            }));
            return false;
        }
    };

    return { sendMessage };
}

async function reconcilePendingMessage({
    chatId,
    currentUserId,
    fallbackText,
    httpPayload,
    messageId,
    updateMessage,
}: {
    chatId: string;
    currentUserId: string;
    fallbackText: string;
    httpPayload: {
        clientMessageId: string;
        senderUserId: string;
        senderNickname: string;
        chatRoomId: string;
        conversationType: "group" | "direct";
        senderPhone: string;
        recipientPhone?: string;
        messageTextContent: string;
        encryptedContent: NonNullable<
            Extract<ClientRealtimeEvent, { type: "SEND_MESSAGE" }>["encryptedContent"]
        >;
        recipientEncryptionKeys: NonNullable<
            Extract<ClientRealtimeEvent, { type: "SEND_MESSAGE" }>["recipientEncryptionKeys"]
        >;
        encryptedChatPreview: NonNullable<
            Extract<ClientRealtimeEvent, { type: "SEND_MESSAGE" }>["encryptedChatPreview"]
        >;
        chatPreviewRecipientKeys: NonNullable<
            Extract<ClientRealtimeEvent, { type: "SEND_MESSAGE" }>["chatPreviewRecipientKeys"]
        >;
    };
    messageId: string;
    updateMessage: (
        chatId: string,
        messageId: string,
        updater: (message: Message) => Message
    ) => void;
}) {
    await new Promise((resolve) => window.setTimeout(resolve, ACK_TIMEOUT_MS));

    const pendingMessage = (
        useActiveChatStore.getState().messagesByChatId[chatId] ?? []
    ).find((message) => message.message_id === messageId);

    if (!pendingMessage || pendingMessage.client_status !== "sending") {
        return;
    }

    try {
        const postResponse = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(httpPayload),
        });

        if (postResponse.ok) {
            const postResult = (await postResponse.json()) as {
                message: Parameters<typeof normalizeMessage>[0];
            };
            const persistedMessage = normalizeMessage(postResult.message);
            const [decryptedPersistedMessage] = await decryptMessageBatch({
                currentUserId,
                messages: [persistedMessage],
            });

            updateMessage(chatId, messageId, () => ({
                ...decryptedPersistedMessage,
                message_text_content:
                    decryptedPersistedMessage.message_text_content ?? fallbackText,
                client_status: "sent",
                client_error: null,
            }));
            return;
        }

        const response = await fetch(
            `/api/messages?chatRoomId=${encodeURIComponent(chatId)}&limit=40`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error("Failed to reconcile message state");
        }

        const payload = (await response.json()) as {
            messages: Parameters<typeof normalizeMessage>[0][];
        };

        const matchedMessage = payload.messages.find(
            (message) => message.message_id === messageId
        );

        if (!matchedMessage) {
            throw new Error("Message confirmation timed out");
        }

        const normalizedMessage = normalizeMessage(matchedMessage);
        const [decryptedMessage] = await decryptMessageBatch({
            currentUserId,
            messages: [normalizedMessage],
        });

        updateMessage(chatId, messageId, () => ({
            ...decryptedMessage,
            message_text_content:
                decryptedMessage.message_text_content ?? fallbackText,
            client_status: "sent",
            client_error: null,
        }));
    } catch (error) {
        updateMessage(chatId, messageId, (message) => ({
            ...message,
            client_status: "failed",
            client_error:
                error instanceof Error
                    ? error.message
                    : "Message confirmation timed out",
        }));
    }
}
