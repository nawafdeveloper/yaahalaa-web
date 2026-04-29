import { importPublicKey } from "@/lib/crypto-keys";
import { base64ToBuffer, bufferToBase64 } from "@/lib/crypto-pin";
import type { ChatItemType } from "@/types/chats.type";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";
import type { Message } from "@/types/messages.type";

type RecipientKeySource = {
    userId: string;
    publicKey: string;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}

async function encryptAesKeyForRecipient(
    rawAesKey: ArrayBuffer,
    publicKeyBase64: string
) {
    const publicKey = await importPublicKey(publicKeyBase64);
    const encrypted = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawAesKey
    );

    return bufferToBase64(encrypted);
}

export async function encryptTextForRecipients(
    plaintext: string,
    recipients: RecipientKeySource[]
): Promise<{
    encryptedContent: EncryptedContentEnvelope;
    recipientEncryptionKeys: RecipientEncryptedAesKeyInput[];
}> {
    const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        new TextEncoder().encode(plaintext)
    );

    const uniqueRecipients = [...new Map(
        recipients
            .filter((recipient) => recipient.userId && recipient.publicKey)
            .map((recipient) => [recipient.userId, recipient])
    ).values()];

    const recipientEncryptionKeys = await Promise.all(
        uniqueRecipients.map(async (recipient) => ({
            recipientUserId: recipient.userId,
            encryptedAesKey: await encryptAesKeyForRecipient(
                rawAesKey,
                recipient.publicKey
            ),
            algorithm: "aes-256-gcm+rsa-oaep-sha256" as const,
        }))
    );

    return {
        encryptedContent: {
            ciphertext: bufferToBase64(ciphertext),
            iv: bufferToBase64(iv),
            algorithm: "aes-256-gcm+rsa-oaep-sha256",
        },
        recipientEncryptionKeys,
    };
}

export async function decryptMessageBatch({
    currentUserId,
    messages,
}: {
    currentUserId: string;
    messages: Message[];
}): Promise<Message[]> {
    const { decryptText } = await import("@/lib/text-encryption");

    return Promise.all(
        messages.map(async (message) => {
            if (
                !message.encrypted_content_ciphertext ||
                !message.encrypted_content_iv ||
                !message.message_recipient_keys?.length
            ) {
                return message;
            }

            const recipientKey = message.message_recipient_keys.find(
                (key) => key.recipient_user_id === currentUserId
            );

            if (!recipientKey) {
                return message;
            }

            try {
                const decryptedText = await decryptText({
                    ciphertext: message.encrypted_content_ciphertext,
                    encryptedAesKey: recipientKey.encrypted_aes_key,
                    iv: message.encrypted_content_iv,
                });

                return {
                    ...message,
                    message_text_content: decryptedText,
                    client_status:
                        message.client_status === "failed"
                            ? "failed"
                            : ("sent" as const),
                } satisfies Message;
            } catch {
                return message;
            }
        })
    );
}

export async function decryptChatPreviewBatch({
    chats,
    currentUserId,
}: {
    chats: ChatItemType[];
    currentUserId: string;
}) {
    const { decryptText } = await import("@/lib/text-encryption");

    return Promise.all(
        chats.map(async (chat) => {
            if (
                !chat.encrypted_preview_ciphertext ||
                !chat.encrypted_preview_iv ||
                !chat.chat_recipient_keys?.length
            ) {
                return chat;
            }

            const recipientKey = chat.chat_recipient_keys.find(
                (key) => key.recipient_user_id === currentUserId
            );

            if (!recipientKey) {
                return chat;
            }

            try {
                const decryptedPreview = await decryptText({
                    ciphertext: chat.encrypted_preview_ciphertext,
                    encryptedAesKey: recipientKey.encrypted_aes_key,
                    iv: chat.encrypted_preview_iv,
                });

                return {
                    ...chat,
                    last_message_context: decryptedPreview,
                };
            } catch {
                return chat;
            }
        })
    );
}

export function buildDirectChatId(
    leftParticipant: string,
    rightParticipant: string
) {
    return [leftParticipant, rightParticipant].filter(Boolean).sort().join("::");
}

export function createOptimisticMessage({
    messageId,
    chatId,
    senderUserId,
    plaintext,
}: {
    messageId: string;
    chatId: string;
    senderUserId: string;
    plaintext: string;
}): Message {
    const now = new Date();

    return {
        message_id: messageId,
        sender_user_id: senderUserId,
        chat_room_id: chatId,
        attached_media: null,
        event: null,
        poll: null,
        reply_message: null,
        location: null,
        media_url: null,
        video_thumbnail: null,
        message_raction: null,
        is_forward_message: false,
        message_text_content: plaintext,
        open_graph_data: null,
        user_ids_pin_it: null,
        user_ids_star_it: null,
        deleted: false,
        user_id_delete_it: null,
        edited: false,
        user_id_edit_it: null,
        created_at: now,
        updated_at: now,
        contact: null,
        client_status: "sending",
        client_error: null,
        encrypted_content_ciphertext: null,
        encrypted_content_iv: null,
        encrypted_content_algorithm: null,
        message_recipient_keys: null,
    };
}
