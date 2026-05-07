import { getCloudflareContext } from "@opennextjs/cloudflare";
import db from "@/db";
import {
    chatReadStates,
    chatRecipientKeys,
    chats,
    contacts,
    message as messageTable,
    user,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { ChatGroupMember, ChatItemType } from "@/types/chats.type";
import type {
    RecipientEncryptedAesKey,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";
import type { GroupSystemEvent, Message } from "@/types/messages.type";
import { getUnreadCountForRecipient } from "@/lib/chat-read-state";

type RealtimeBindings = {
    CHAT_ROOM_DO?: DurableObjectNamespace;
    USER_PRESENCE_DO?: DurableObjectNamespace;
};

export function normalizeChatRecipientKeys(
    keys: RecipientEncryptedAesKeyInput[] | null | undefined
): RecipientEncryptedAesKey[] {
    return (keys ?? [])
        .filter((key) => key.recipientUserId && key.encryptedAesKey)
        .map((key) => ({
            recipient_user_id: key.recipientUserId,
            encrypted_aes_key: key.encryptedAesKey,
            algorithm: key.algorithm ?? "aes-256-gcm+rsa-oaep-sha256",
        }));
}

export function recipientKeysCoverParticipants(
    keys: RecipientEncryptedAesKey[],
    participantIds: string[]
) {
    if (participantIds.length === 0) {
        return false;
    }

    const recipientIds = new Set(
        keys.map((key) => key.recipient_user_id).filter(Boolean)
    );

    return participantIds.every((participantId) =>
        recipientIds.has(participantId)
    );
}

export async function getGroupMembers(chatId: string): Promise<ChatGroupMember[]> {
    const rows = await db
        .select({
            userId: user.id,
            phoneNumber: user.phoneNumber,
            publicKey: user.yhlaPublicKey,
            name: user.name,
            avatar: user.image,
            isAdmin: chatRecipientKeys.is_admin,
        })
        .from(chatRecipientKeys)
        .innerJoin(user, eq(chatRecipientKeys.recipient_user_id, user.id))
        .where(eq(chatRecipientKeys.chat_id, chatId));

    return rows.map((member) => ({
        user_id: member.userId,
        phone_number: member.phoneNumber,
        public_key: member.publicKey,
        name: member.name,
        avatar: member.avatar,
        is_admin: member.isAdmin,
    }));
}

export async function getGroupParticipantIds(chatId: string) {
    const rows = await db
        .select({
            userId: chatRecipientKeys.recipient_user_id,
        })
        .from(chatRecipientKeys)
        .where(eq(chatRecipientKeys.chat_id, chatId));

    return [...new Set(rows.map((row) => row.userId).filter(Boolean))];
}

export async function getGroupChatForUser({
    chatId,
    userId,
}: {
    chatId: string;
    userId: string;
}): Promise<ChatItemType | null> {
    const [member] = await db
        .select({ chatId: chatRecipientKeys.chat_id })
        .from(chatRecipientKeys)
        .where(
            and(
                eq(chatRecipientKeys.chat_id, chatId),
                eq(chatRecipientKeys.recipient_user_id, userId)
            )
        )
        .limit(1);

    if (!member) {
        return null;
    }

    const chat = await db.query.chats.findFirst({
        where: eq(chats.chat_id, chatId),
    });

    if (!chat || chat.chat_type !== "group") {
        return null;
    }

    const [members, keyRows] = await Promise.all([
        getGroupMembers(chatId),
        db
            .select()
            .from(chatRecipientKeys)
            .where(eq(chatRecipientKeys.chat_id, chatId)),
    ]);

    return {
        ...chat,
        group_members: members,
        chat_recipient_keys: keyRows.map((key) => ({
            recipient_user_id: key.recipient_user_id,
            encrypted_aes_key: key.encrypted_aes_key,
            algorithm: key.algorithm,
        })),
        last_message_is_read_by_recipient: null,
        last_message_read_by_user_ids: null,
        last_message_recipient_user_ids: members
            .map((memberItem) => memberItem.user_id)
            .filter((memberId) => memberId !== chat.last_message_sender_nickname),
    };
}

export async function isGroupAdmin({
    chatId,
    userId,
}: {
    chatId: string;
    userId: string;
}) {
    const [member] = await db
        .select({
            isAdmin: chatRecipientKeys.is_admin,
        })
        .from(chatRecipientKeys)
        .where(
            and(
                eq(chatRecipientKeys.chat_id, chatId),
                eq(chatRecipientKeys.recipient_user_id, userId)
            )
        )
        .limit(1);

    return Boolean(member?.isAdmin);
}

export async function getSavedContactUserIds({
    ownerUserId,
    linkedUserIds,
}: {
    ownerUserId: string;
    linkedUserIds: string[];
}) {
    if (linkedUserIds.length === 0) {
        return new Set<string>();
    }

    const rows = await db
        .select({
            linkedUserId: contacts.linked_user_id,
        })
        .from(contacts)
        .where(
            and(
                eq(contacts.owner_user_id, ownerUserId),
                inArray(contacts.linked_user_id, linkedUserIds)
            )
        );

    return new Set(rows.map((row) => row.linkedUserId));
}

export async function upsertGroupReadState({
    chatId,
    userId,
    readAt,
}: {
    chatId: string;
    userId: string;
    readAt: Date;
}) {
    await db
        .insert(chatReadStates)
        .values({
            id: crypto.randomUUID(),
            chat_id: chatId,
            user_id: userId,
            last_read_at: readAt,
            created_at: readAt,
            updated_at: readAt,
        })
        .onConflictDoUpdate({
            target: [chatReadStates.chat_id, chatReadStates.user_id],
            set: {
                last_read_at: readAt,
                updated_at: readAt,
            },
        });
}

export async function broadcastGroupChatUpdate({
    actorUserId,
    chat,
    participantIds,
}: {
    actorUserId: string;
    chat: ChatItemType;
    participantIds: string[];
}) {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bindings = env as unknown as RealtimeBindings;
        const presenceNamespace = bindings.USER_PRESENCE_DO;

        if (!presenceNamespace) {
            return;
        }

        await Promise.all(
            [...new Set(participantIds)]
                .filter(
                    (participantId) =>
                        participantId && participantId !== actorUserId
                )
                .map(async (participantId) => {
                    const userDO = presenceNamespace.get(
                        presenceNamespace.idFromName(participantId)
                    );

                    await userDO.fetch("https://do/event", {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                        },
                        body: JSON.stringify({
                            type: "GROUP_CREATED",
                            chat,
                        }),
                    });
                })
        );
    } catch {
        // Realtime fanout is best-effort; the database already has the update.
    }
}

export async function createAndBroadcastGroupSystemMessage({
    chatId,
    actorUserId,
    event,
    participantIds,
}: {
    chatId: string;
    actorUserId: string;
    event: GroupSystemEvent;
    participantIds: string[];
}) {
    const systemMessage = await createGroupSystemMessage({
        chatId,
        actorUserId,
        event,
    });

    await broadcastGroupSystemMessage({
        message: systemMessage,
        participantIds,
    });

    return systemMessage;
}

async function createGroupSystemMessage({
    chatId,
    actorUserId,
    event,
}: {
    chatId: string;
    actorUserId: string;
    event: GroupSystemEvent;
}): Promise<Message> {
    const now = new Date();
    const messageId = crypto.randomUUID();
    const previewText = formatGroupSystemEventText(event);

    await db.insert(messageTable).values({
        message_id: messageId,
        sender_user_id: actorUserId,
        chat_room_id: chatId,
        encrypted_content_ciphertext: null,
        encrypted_content_iv: null,
        encrypted_content_algorithm: null,
        attached_media: null,
        event,
        poll: null,
        reply_message: null,
        location: null,
        media_url: null,
        media_preview_url: null,
        media_size_bytes: null,
        media_width: null,
        media_height: null,
        media_file_name: null,
        video_thumbnail: null,
        message_raction: null,
        is_forward_message: false,
        message_text_content: previewText,
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
    });

    await db
        .update(chats)
        .set({
            last_message_id: messageId,
            encrypted_preview_ciphertext: null,
            encrypted_preview_iv: null,
            encrypted_preview_algorithm: null,
            last_message_context: previewText,
            last_message_media: null,
            last_message_sender_is_me: false,
            last_message_sender_nickname: actorUserId,
            updated_at: now,
        })
        .where(eq(chats.chat_id, chatId));

    return {
        message_id: messageId,
        sender_user_id: actorUserId,
        chat_room_id: chatId,
        encrypted_content_ciphertext: null,
        encrypted_content_iv: null,
        encrypted_content_algorithm: null,
        message_recipient_keys: null,
        attached_media: null,
        event,
        poll: null,
        reply_message: null,
        location: null,
        media_url: null,
        media_preview_url: null,
        media_size_bytes: null,
        media_width: null,
        media_height: null,
        media_file_name: null,
        video_thumbnail: null,
        message_raction: null,
        is_forward_message: false,
        message_text_content: previewText,
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
        is_read_by_recipient: false,
        read_by_user_ids: [],
    };
}

async function broadcastGroupSystemMessage({
    message,
    participantIds,
}: {
    message: Message;
    participantIds: string[];
}) {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bindings = env as unknown as RealtimeBindings;
        const roomNamespace = bindings.CHAT_ROOM_DO;
        const presenceNamespace = bindings.USER_PRESENCE_DO;

        if (!roomNamespace || !presenceNamespace) {
            return;
        }

        const realtimeMessage = {
            ...message,
            created_at: message.created_at.toISOString(),
            updated_at: message.updated_at.toISOString(),
        };
        const roomDO = roomNamespace.get(roomNamespace.idFromName(message.chat_room_id));

        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                type: "NEW_MESSAGE",
                conversationId: message.chat_room_id,
                conversationType: "group",
                message: realtimeMessage,
            }),
        });

        await Promise.all(
            [...new Set(participantIds)]
                .filter((participantId) => participantId)
                .map(async (participantId) => {
                    const userDO = presenceNamespace.get(
                        presenceNamespace.idFromName(participantId)
                    );
                    const unreadCount = await getUnreadCountForRecipient({
                        chatId: message.chat_room_id,
                        userId: participantId,
                    });

                    await userDO.fetch("https://do/event", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            type: "CONVERSATION_UPDATED",
                            conversationId: message.chat_room_id,
                            conversationType: "group",
                            lastMessage: realtimeMessage,
                            unreadCount,
                        }),
                    });
                })
        );
    } catch {
        // Realtime fanout is best-effort; the database already has the event.
    }
}

export function formatGroupSystemEventText(event: GroupSystemEvent) {
    const actor = event.actor_name?.trim() || "Someone";
    const targetNames = (event.target_names ?? []).filter(Boolean);
    const targetLabel =
        targetNames.length > 0
            ? targetNames.join(", ")
            : event.target_user_ids?.join(", ") || "a member";

    switch (event.action) {
        case "member-left":
            return `${targetLabel} left the group`;
        case "member-added":
            return `${actor} added ${targetLabel}`;
        case "name-changed":
            return event.next_name
                ? `${actor} changed the group name to ${event.next_name}`
                : `${actor} changed the group name`;
        case "image-changed":
            return `${actor} changed the group image`;
        default:
            return "Group updated";
    }
}
