"use client";

import { authClient } from "@/lib/auth-client";
import {
    createOptimisticMessage,
    decryptMessageBatch,
    encryptTextForRecipients,
    serializeSharedContactMessage,
} from "@/lib/chat-e2ee";
import { getContactDisplayName } from "@/lib/contact-display";
import { buildChatFromMessage, normalizeMessage } from "@/lib/chat-utils";
import {
    createMediaDebugTraceId,
    logMediaDebug,
} from "@/lib/message-media-debug";
import { persistDecryptedMessageMedia, uploadEncryptedMessageMedia } from "@/lib/message-media-upload";
import { createMessageMediaPreview } from "@/lib/message-media-preview";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useRealtimeStore } from "@/store/use-realtime-store";
import type { ChatItemType } from "@/types/chats.type";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";
import type { Contact as DirectoryContact } from "@/types/contacts.type";
import type { Message } from "@/types/messages.type";
import type { ClientRealtimeEvent } from "@/types/realtime-events";

const ACK_TIMEOUT_MS = 800;

type RecipientKeySource = {
    userId: string;
    publicKey: string;
};

type HttpMessagePayload = {
    debugTraceId?: string;
    clientMessageId: string;
    senderUserId: string;
    senderNickname: string;
    chatRoomId: string;
    conversationType: "group" | "direct";
    senderPhone: string;
    recipientPhone?: string;
    attachedMedia?: Message["attached_media"] | null;
    mediaUrl?: string | null;
    mediaPreviewUrl?: string | null;
    mediaSizeBytes?: number | null;
    videoThumbnail?: string | null;
    encryptedContent?: EncryptedContentEnvelope | null;
    recipientEncryptionKeys?: RecipientEncryptedAesKeyInput[] | null;
    encryptedChatPreview?: EncryptedContentEnvelope | null;
    chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
};

type ConversationContext = {
    selectedChat: ChatItemType;
    conversationType: "group" | "direct";
    recipientUserId?: string;
    recipientPhoneForTransport?: string;
    recipients: RecipientKeySource[];
};

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

    const resolveConversationContext = ({
        chatId,
        currentUserId,
        currentPublicKey,
        requirePeerEncryption = false,
    }: {
        chatId: string;
        currentUserId: string;
        currentPublicKey: string;
        requirePeerEncryption?: boolean;
    }): ConversationContext | null => {
        const selectedChat = chats.find((chat) => chat.chat_id === chatId) ?? null;
        if (!selectedChat) {
            return null;
        }

        const conversationType: "group" | "direct" =
            selectedChat.chat_type === "group" ? "group" : "direct";
        const recipients: RecipientKeySource[] = [
            {
                userId: currentUserId,
                publicKey: currentPublicKey,
            },
        ];
        const recipientUserId = selectedChat.recipient_user_id ?? undefined;
        const recipientPublicKey = selectedChat.recipient_public_key ?? undefined;

        if (recipientUserId && recipientPublicKey) {
            recipients.push({
                userId: recipientUserId,
                publicKey: recipientPublicKey,
            });
        }

        if (requirePeerEncryption) {
            if (selectedChat.chat_type !== "single") {
                throw new Error(
                    "Encrypted attachments for group chats need participant public keys in the client first."
                );
            }

            if (!recipientUserId || !recipientPublicKey) {
                throw new Error(
                    "This chat is missing the recipient encryption key."
                );
            }
        }

        return {
            selectedChat,
            conversationType,
            recipientUserId,
            recipientPhoneForTransport:
                recipientPhone ?? selectedChat.contact_phone ?? undefined,
            recipients,
        };
    };

    const dispatchPreparedMessage = async ({
        chatId,
        currentUserId,
        currentPhone,
        messageId,
        optimisticMessage,
        conversation,
        clearDraft = false,
        existingMessageId,
        debugTraceId,
        encryptedContent = null,
        recipientEncryptionKeys = null,
        encryptedChatPreview = null,
        chatPreviewRecipientKeys = null,
    }: {
        chatId: string;
        currentUserId: string;
        currentPhone: string;
        messageId: string;
        optimisticMessage: Message;
        conversation: ConversationContext;
        clearDraft?: boolean;
        existingMessageId?: string;
        debugTraceId?: string;
        encryptedContent?: EncryptedContentEnvelope | null;
        recipientEncryptionKeys?: RecipientEncryptedAesKeyInput[] | null;
        encryptedChatPreview?: EncryptedContentEnvelope | null;
        chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
    }) => {
        const senderNickname = session?.user.name ?? currentPhone;

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
                conversationType: conversation.conversationType,
                message: optimisticMessage,
                currentUserId,
                unreadCount: 0,
                fallbackExistingChat: conversation.selectedChat,
            })
        );

        if (clearDraft) {
            setDraft(chatId, "");
        }

        try {
            if (optimisticMessage.attached_media) {
                logMediaDebug("client.message.dispatch.start", {
                    debugTraceId: debugTraceId ?? null,
                    messageId,
                    chatId,
                    attachedMedia: optimisticMessage.attached_media,
                    mediaUrl: optimisticMessage.media_url,
                    previewUrl: optimisticMessage.media_preview_url ?? null,
                    mediaSizeBytes: optimisticMessage.media_size_bytes ?? null,
                    recipientUserId: conversation.recipientUserId ?? null,
                });
            }

            const payload: Extract<ClientRealtimeEvent, { type: "SEND_MESSAGE" }> =
                {
                    type: "SEND_MESSAGE",
                    debugTraceId,
                    clientMessageId: messageId,
                    conversationId: chatId,
                    conversationType: conversation.conversationType,
                    senderUserId: currentUserId,
                    senderNickname,
                    senderPhone: currentPhone,
                    recipientUserId: conversation.recipientUserId,
                    recipientPhone: conversation.recipientPhoneForTransport,
                    attachedMedia: optimisticMessage.attached_media,
                    mediaUrl: optimisticMessage.media_url,
                    mediaPreviewUrl: optimisticMessage.media_preview_url ?? null,
                    mediaSizeBytes: optimisticMessage.media_size_bytes ?? null,
                    videoThumbnail: optimisticMessage.video_thumbnail,
                    encryptedContent,
                    recipientEncryptionKeys,
                    encryptedChatPreview,
                    chatPreviewRecipientKeys,
                };
            const httpPayload: HttpMessagePayload = {
                debugTraceId,
                clientMessageId: messageId,
                senderUserId: currentUserId,
                senderNickname,
                chatRoomId: chatId,
                conversationType: conversation.conversationType,
                senderPhone: currentPhone,
                recipientPhone: conversation.recipientPhoneForTransport,
                attachedMedia: optimisticMessage.attached_media,
                mediaUrl: optimisticMessage.media_url,
                mediaPreviewUrl: optimisticMessage.media_preview_url ?? null,
                mediaSizeBytes: optimisticMessage.media_size_bytes ?? null,
                videoThumbnail: optimisticMessage.video_thumbnail,
                encryptedContent,
                recipientEncryptionKeys,
                encryptedChatPreview,
                chatPreviewRecipientKeys,
            };

            const realtimeSent = sendRealtimeEvent(payload);
            if (optimisticMessage.attached_media) {
                logMediaDebug("client.message.dispatch.transport", {
                    debugTraceId: debugTraceId ?? null,
                    messageId,
                    transport: realtimeSent ? "realtime" : "http",
                });
            }

            if (!realtimeSent) {
                const response = await fetch("/api/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(debugTraceId
                            ? { "x-media-debug-id": debugTraceId }
                            : {}),
                    },
                    body: JSON.stringify(httpPayload),
                });

                if (!response.ok) {
                    if (optimisticMessage.attached_media) {
                        logMediaDebug("client.message.dispatch.http-failed", {
                            debugTraceId: debugTraceId ?? null,
                            messageId,
                            status: response.status,
                        });
                    }
                    throw new Error("Failed to send message");
                }

                const result = (await response.json()) as {
                    message: Parameters<typeof normalizeMessage>[0];
                };
                const nextMessage = normalizeMessage(result.message);
                const [decryptedNextMessage] = await decryptMessageBatch({
                    currentUserId,
                    messages: [nextMessage],
                });

                updateMessage(chatId, messageId, () =>
                    finalizeReconciledMessage(decryptedNextMessage, optimisticMessage)
                );
                if (optimisticMessage.attached_media) {
                    logMediaDebug("client.message.dispatch.http-success", {
                        debugTraceId: debugTraceId ?? null,
                        messageId,
                        persistedMessageId: nextMessage.message_id,
                    });
                }
                return;
            }

            void reconcilePendingMessage({
                chatId,
                currentUserId,
                fallbackMessage: optimisticMessage,
                httpPayload,
                messageId,
                updateMessage,
            });
        } catch (error) {
            if (optimisticMessage.attached_media) {
                logMediaDebug("client.message.dispatch.error", {
                    debugTraceId: debugTraceId ?? null,
                    messageId,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to send message",
                });
            }
            updateMessage(chatId, messageId, (message) => ({
                ...message,
                client_status: "failed",
                client_error:
                    error instanceof Error ? error.message : "Failed to send message",
            }));
            throw error;
        }
    };

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

        const conversation = resolveConversationContext({
            chatId,
            currentUserId,
            currentPublicKey,
        });
        if (!conversation) {
            return false;
        }

        const messageId = existingMessageId ?? crypto.randomUUID();
        const optimisticMessage = createOptimisticMessage({
            messageId,
            chatId,
            senderUserId: currentUserId,
            plaintext: trimmed,
        });

        try {
            const encryptedMessage = await encryptTextForRecipients(
                trimmed,
                conversation.recipients
            );
            const encryptedPreview = await encryptTextForRecipients(
                trimmed,
                conversation.recipients
            );

            await dispatchPreparedMessage({
                chatId,
                currentUserId,
                currentPhone,
                messageId,
                optimisticMessage,
                conversation,
                clearDraft,
                existingMessageId,
                encryptedContent: encryptedMessage.encryptedContent,
                recipientEncryptionKeys: encryptedMessage.recipientEncryptionKeys,
                encryptedChatPreview: encryptedPreview.encryptedContent,
                chatPreviewRecipientKeys: encryptedPreview.recipientEncryptionKeys,
            });

            return true;
        } catch (error) {
            return false;
        }
    };

    const sendAttachment = async ({
        file,
        attachedMedia,
        chatId = selectedChatId,
    }: {
        file: File;
        attachedMedia: Extract<
            Message["attached_media"],
            "photo" | "video" | "voice" | "file"
        >;
        chatId?: string | null;
    }) => {
        const currentUserId = session?.user.id;
        const currentPhone = (session?.user as { phoneNumber?: string | null } | undefined)
            ?.phoneNumber;
        const currentPublicKey = (session?.user as { yhlaPublicKey?: string | null } | undefined)
            ?.yhlaPublicKey;

        if (!chatId || !currentUserId || !currentPhone || !currentPublicKey) {
            return false;
        }

        const conversation = resolveConversationContext({
            chatId,
            currentUserId,
            currentPublicKey,
            requirePeerEncryption: true,
        });
        if (!conversation) {
            return false;
        }

        const messageId = crypto.randomUUID();
        const debugTraceId = createMediaDebugTraceId(attachedMedia);
        const localMediaUrl = URL.createObjectURL(file);
        const localPreviewBlob = await createMessageMediaPreview(file);
        const localPreviewUrl =
            localPreviewBlob ? URL.createObjectURL(localPreviewBlob) : localMediaUrl;
        logMediaDebug("client.attachment.prepare", {
            debugTraceId,
            messageId,
            attachedMedia,
            chatId,
            fileName: file.name,
            fileType: file.type || null,
            fileSize: file.size,
            previewSize: localPreviewBlob?.size ?? null,
            recipientIds: conversation.recipients.map((recipient) => recipient.userId),
        });
        const optimisticMessage = createOptimisticMessage({
            messageId,
            chatId,
            senderUserId: currentUserId,
            attachedMedia,
            mediaUrl: localMediaUrl,
            mediaPreviewUrl: localPreviewUrl,
            mediaSizeBytes: file.size,
            clientLocalMediaName: file.name,
            clientLocalMediaSize: file.size,
            clientLocalMediaMimeType: file.type || null,
        });

        appendMessage(chatId, optimisticMessage);
        upsertChat(
            buildChatFromMessage({
                conversationId: chatId,
                conversationType: conversation.conversationType,
                message: optimisticMessage,
                currentUserId,
                unreadCount: 0,
                fallbackExistingChat: conversation.selectedChat,
            })
        );

        try {
            const upload = await uploadEncryptedMessageMedia(
                file,
                conversation.recipients.map((recipient) => ({
                    recipientUserId: recipient.userId,
                    publicKey: recipient.publicKey,
                })),
                localPreviewBlob,
                debugTraceId
            );

            updateMessage(chatId, messageId, (message) => ({
                ...message,
                media_url: upload.mediaUrl,
                media_preview_url: upload.previewUrl,
                media_size_bytes: upload.sizeBytes,
                client_status: "sending",
                client_error: null,
            }));

            await persistDecryptedMessageMedia(upload.objectKey, file);
            logMediaDebug("client.attachment.upload-complete", {
                debugTraceId,
                messageId,
                objectKey: upload.objectKey,
                mediaUrl: upload.mediaUrl,
                previewUrl: upload.previewUrl,
                recipientKeyCount: upload.recipientEncryptionKeys.length,
            });

            await dispatchPreparedMessage({
                chatId,
                currentUserId,
                currentPhone,
                messageId,
                optimisticMessage: {
                    ...optimisticMessage,
                    media_url: upload.mediaUrl,
                    media_preview_url: upload.previewUrl,
                    media_size_bytes: upload.sizeBytes,
                },
                conversation,
                existingMessageId: messageId,
                debugTraceId,
                recipientEncryptionKeys: upload.recipientEncryptionKeys,
            });
        } catch (error) {
            logMediaDebug("client.attachment.failed", {
                debugTraceId,
                messageId,
                error:
                    error instanceof Error ? error.message : "Failed to send attachment",
            });
            updateMessage(chatId, messageId, (message) => ({
                ...message,
                client_status: "failed",
                client_error:
                    error instanceof Error ? error.message : "Failed to send attachment",
            }));
            return false;
        }

        return true;
    };

    const sendContact = async ({
        contact,
        chatId = selectedChatId,
    }: {
        contact: DirectoryContact;
        chatId?: string | null;
    }) => {
        const currentUserId = session?.user.id;
        const currentPhone = (session?.user as { phoneNumber?: string | null } | undefined)
            ?.phoneNumber;
        const currentPublicKey = (session?.user as { yhlaPublicKey?: string | null } | undefined)
            ?.yhlaPublicKey;

        if (!chatId || !currentUserId || !currentPhone || !currentPublicKey) {
            return false;
        }

        const conversation = resolveConversationContext({
            chatId,
            currentUserId,
            currentPublicKey,
            requirePeerEncryption: true,
        });
        if (!conversation) {
            return false;
        }

        const sharedContact: NonNullable<Message["contact"]> = {
            contact_id: contact.contact_id,
            contact_name: getContactDisplayName(contact),
            contact_image: contact.contact_avatar ?? "",
            contact_phone: contact.contact_number,
            linked_user_id: contact.linked_user_id ?? null,
        };
        const encryptedMessage = await encryptTextForRecipients(
            serializeSharedContactMessage(sharedContact),
            conversation.recipients
        );
        const encryptedPreview = await encryptTextForRecipients(
            "Contact",
            conversation.recipients
        );
        const messageId = crypto.randomUUID();
        const optimisticMessage = createOptimisticMessage({
            messageId,
            chatId,
            senderUserId: currentUserId,
            attachedMedia: "contact",
            contact: sharedContact,
        });

        await dispatchPreparedMessage({
            chatId,
            currentUserId,
            currentPhone,
            messageId,
            optimisticMessage,
            conversation,
            encryptedContent: encryptedMessage.encryptedContent,
            recipientEncryptionKeys: encryptedMessage.recipientEncryptionKeys,
            encryptedChatPreview: encryptedPreview.encryptedContent,
            chatPreviewRecipientKeys: encryptedPreview.recipientEncryptionKeys,
        });

        return true;
    };

    return { sendMessage, sendAttachment, sendContact };
}

async function reconcilePendingMessage({
    chatId,
    currentUserId,
    fallbackMessage,
    httpPayload,
    messageId,
    updateMessage,
}: {
    chatId: string;
    currentUserId: string;
    fallbackMessage: Message;
    httpPayload: HttpMessagePayload;
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
            headers: {
                "Content-Type": "application/json",
                ...(httpPayload.debugTraceId
                    ? { "x-media-debug-id": httpPayload.debugTraceId }
                    : {}),
            },
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

            updateMessage(chatId, messageId, () =>
                finalizeReconciledMessage(decryptedPersistedMessage, fallbackMessage)
            );
            if (fallbackMessage.attached_media) {
                logMediaDebug("client.reconcile.http-success", {
                    debugTraceId: httpPayload.debugTraceId ?? null,
                    messageId,
                    persistedMessageId: persistedMessage.message_id,
                });
            }
            return;
        }

        if (fallbackMessage.attached_media) {
            logMediaDebug("client.reconcile.http-fallback", {
                debugTraceId: httpPayload.debugTraceId ?? null,
                messageId,
                status: postResponse.status,
            });
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

        updateMessage(chatId, messageId, () =>
            finalizeReconciledMessage(decryptedMessage, fallbackMessage)
        );
        if (fallbackMessage.attached_media) {
            logMediaDebug("client.reconcile.fetch-success", {
                debugTraceId: httpPayload.debugTraceId ?? null,
                messageId,
                foundMessageId: normalizedMessage.message_id,
            });
        }
    } catch (error) {
        if (fallbackMessage.attached_media) {
            logMediaDebug("client.reconcile.failed", {
                debugTraceId: httpPayload.debugTraceId ?? null,
                messageId,
                error:
                    error instanceof Error
                        ? error.message
                        : "Message confirmation timed out",
            });
        }
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

function finalizeReconciledMessage(
    persistedMessage: Message,
    fallbackMessage: Message
): Message {
    return {
        ...persistedMessage,
        client_local_media_name:
            persistedMessage.client_local_media_name ??
            fallbackMessage.client_local_media_name ??
            null,
        client_local_media_size:
            persistedMessage.client_local_media_size ??
            fallbackMessage.client_local_media_size ??
            null,
        client_local_media_mime_type:
            persistedMessage.client_local_media_mime_type ??
            fallbackMessage.client_local_media_mime_type ??
            null,
        attached_media: persistedMessage.attached_media ?? fallbackMessage.attached_media,
        media_url: persistedMessage.media_url ?? fallbackMessage.media_url,
        media_preview_url:
            persistedMessage.media_preview_url ?? fallbackMessage.media_preview_url,
        media_size_bytes:
            persistedMessage.media_size_bytes ?? fallbackMessage.media_size_bytes,
        video_thumbnail:
            persistedMessage.video_thumbnail ?? fallbackMessage.video_thumbnail,
        message_text_content:
            persistedMessage.message_text_content ?? fallbackMessage.message_text_content,
        contact: persistedMessage.contact ?? fallbackMessage.contact,
        client_status: "sent",
        client_error: null,
    };
}
