import { importPublicKey } from "@/lib/crypto-keys";
import { bufferToBase64 } from "@/lib/crypto-pin";
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

type SharedContactMessagePayload = {
    kind: "contact";
    contact: NonNullable<Message["contact"]>;
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
                const sharedContact =
                    message.attached_media === "contact"
                        ? parseSharedContactMessage(decryptedText)
                        : null;

                return {
                    ...message,
                    message_text_content: sharedContact ? null : decryptedText,
                    contact: sharedContact ?? message.contact,
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
    plaintext = null,
    attachedMedia = null,
    mediaUrl = null,
    mediaPreviewUrl = null,
    mediaSizeBytes = null,
    videoThumbnail = null,
    contact = null,
    clientLocalMediaName = null,
    clientLocalMediaSize = null,
    clientLocalMediaMimeType = null,
}: {
    messageId: string;
    chatId: string;
    senderUserId: string;
    plaintext?: string | null;
    attachedMedia?: Message["attached_media"];
    mediaUrl?: string | null;
    mediaPreviewUrl?: string | null;
    mediaSizeBytes?: number | null;
    videoThumbnail?: string | null;
    contact?: Message["contact"] | null;
    clientLocalMediaName?: string | null;
    clientLocalMediaSize?: number | null;
    clientLocalMediaMimeType?: string | null;
}): Message {
    const now = new Date();

    return {
        message_id: messageId,
        sender_user_id: senderUserId,
        chat_room_id: chatId,
        client_local_media_name: clientLocalMediaName,
        client_local_media_size: clientLocalMediaSize,
        client_local_media_mime_type: clientLocalMediaMimeType,
        attached_media: attachedMedia,
        event: null,
        poll: null,
        reply_message: null,
        location: null,
        media_url: mediaUrl,
        media_preview_url: mediaPreviewUrl,
        media_size_bytes: mediaSizeBytes,
        video_thumbnail: videoThumbnail,
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
        contact,
        client_status: "sending",
        client_error: null,
        encrypted_content_ciphertext: null,
        encrypted_content_iv: null,
        encrypted_content_algorithm: null,
        message_recipient_keys: null,
    };
}

export function serializeSharedContactMessage(
    contact: NonNullable<Message["contact"]>
) {
    return JSON.stringify({
        kind: "contact",
        contact,
    } satisfies SharedContactMessagePayload);
}

function parseSharedContactMessage(
    payload: string
): NonNullable<Message["contact"]> | null {
    try {
        const parsed = JSON.parse(payload) as Partial<SharedContactMessagePayload>;

        if (
            parsed.kind !== "contact" ||
            !parsed.contact?.contact_id ||
            !parsed.contact.contact_name
        ) {
            return null;
        }

        return {
            contact_id: parsed.contact.contact_id,
            contact_name: parsed.contact.contact_name,
            contact_image: parsed.contact.contact_image ?? "",
            contact_phone: parsed.contact.contact_phone ?? null,
            linked_user_id: parsed.contact.linked_user_id ?? null,
        };
    } catch {
        return null;
    }
}
