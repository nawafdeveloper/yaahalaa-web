import { getCloudflareContext } from "@opennextjs/cloudflare";
import db from "@/db";
import {
    chatReadStates,
    chatRecipientKeys,
    chats,
    contacts,
    user,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { ChatGroupMember, ChatItemType } from "@/types/chats.type";
import type {
    RecipientEncryptedAesKey,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";

type RealtimeBindings = {
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
