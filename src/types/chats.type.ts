import type {
    RecipientEncryptedAesKey,
    TextEncryptionAlgorithm,
} from "./crypto";

export type ChatItemType = {
    chat_id: string;
    chat_type: 'single' | 'group';
    avatar: string;
    display_name?: string | null;
    recipient_user_id?: string | null;
    recipient_public_key?: string | null;
    contact_phone?: string | null;
    is_provisional?: boolean;
    last_message_id?: string | null;
    encrypted_preview_ciphertext?: string | null;
    encrypted_preview_iv?: string | null;
    encrypted_preview_algorithm?: TextEncryptionAlgorithm | null;
    chat_recipient_keys?: RecipientEncryptedAesKey[] | null;
    last_message_context: string;
    last_message_media: string | null;
    last_message_sender_is_me: boolean;
    last_message_sender_nickname: string;
    is_unreaded_chat: boolean;
    unreaded_messages_length: number;
    is_archived_chat: boolean;
    is_muted_chat_notifications: boolean;
    is_pinned_chat: boolean;
    is_favourite_chat: boolean;
    is_blocked_chat: boolean;
    created_at: Date;
    updated_at: Date;
};
