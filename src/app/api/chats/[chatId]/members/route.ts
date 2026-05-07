import { auth } from "@/lib/auth";
import db from "@/db";
import { chatRecipientKeys, chats, user } from "@/db/schema";
import {
    broadcastGroupChatUpdate,
    createAndBroadcastGroupSystemMessage,
    getGroupChatForUser,
    getGroupParticipantIds,
    getSavedContactUserIds,
    isGroupAdmin,
    normalizeChatRecipientKeys,
    recipientKeysCoverParticipants,
    upsertGroupReadState,
} from "@/lib/group-chat-server";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";
import { and, eq, inArray } from "drizzle-orm";

type UserSessionShape = {
    id: string;
};

function jsonError(message: string, status: number) {
    return Response.json({ error: message }, { status });
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return jsonError("Unauthorized", 401);
    }

    const { chatId } = await params;
    const sessionUser = session.user as UserSessionShape;
    const canManage = await isGroupAdmin({
        chatId,
        userId: sessionUser.id,
    });

    if (!canManage) {
        return jsonError("Only group admins can invite members.", 403);
    }

    const body = (await request.json()) as {
        memberUserIds?: string[];
        encryptedChatPreview?: EncryptedContentEnvelope | null;
        chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
    };
    const currentParticipantIds = await getGroupParticipantIds(chatId);
    const requestedMemberIds = [
        ...new Set(
            (body.memberUserIds ?? [])
                .map((memberId) => memberId.trim())
                .filter(
                    (memberId) =>
                        memberId && !currentParticipantIds.includes(memberId)
                )
        ),
    ];

    if (requestedMemberIds.length === 0) {
        return jsonError("Select at least one new member.", 400);
    }

    const allowedMemberIds = await getSavedContactUserIds({
        ownerUserId: sessionUser.id,
        linkedUserIds: requestedMemberIds,
    });

    if (requestedMemberIds.some((memberId) => !allowedMemberIds.has(memberId))) {
        return jsonError(
            "Every invited member must be one of your saved contacts.",
            403
        );
    }

    const invitedUsers = await db
        .select({
            userId: user.id,
            name: user.name,
            phoneNumber: user.phoneNumber,
            publicKey: user.yhlaPublicKey,
        })
        .from(user)
        .where(inArray(user.id, requestedMemberIds));

    if (invitedUsers.length !== requestedMemberIds.length) {
        return jsonError("One of the selected members no longer exists.", 400);
    }

    if (invitedUsers.some((member) => !member.publicKey)) {
        return jsonError(
            "Every invited member must have encryption keys set up.",
            400
        );
    }

    if (
        !body.encryptedChatPreview?.ciphertext ||
        !body.encryptedChatPreview.iv ||
        !body.chatPreviewRecipientKeys?.length
    ) {
        return jsonError(
            "Encrypted group preview and recipient keys are required.",
            400
        );
    }

    const nextParticipantIds = [
        ...new Set([...currentParticipantIds, ...requestedMemberIds]),
    ];
    const normalizedPreviewKeys = normalizeChatRecipientKeys(
        body.chatPreviewRecipientKeys
    );

    if (
        !recipientKeysCoverParticipants(
            normalizedPreviewKeys,
            nextParticipantIds
        )
    ) {
        return jsonError(
            "Group encryption keys must match every group member.",
            400
        );
    }

    const now = new Date();
    await db
        .update(chats)
        .set({
            encrypted_preview_ciphertext:
                body.encryptedChatPreview.ciphertext,
            encrypted_preview_iv: body.encryptedChatPreview.iv,
            encrypted_preview_algorithm: body.encryptedChatPreview.algorithm,
            updated_at: now,
        })
        .where(eq(chats.chat_id, chatId));

    for (const key of normalizedPreviewKeys) {
        await db
            .insert(chatRecipientKeys)
            .values({
                id: crypto.randomUUID(),
                chat_id: chatId,
                recipient_user_id: key.recipient_user_id,
                encrypted_aes_key: key.encrypted_aes_key,
                is_admin: false,
                algorithm: key.algorithm,
                created_at: now,
                updated_at: now,
            })
            .onConflictDoUpdate({
                target: [
                    chatRecipientKeys.chat_id,
                    chatRecipientKeys.recipient_user_id,
                ],
                set: {
                    encrypted_aes_key: key.encrypted_aes_key,
                    algorithm: key.algorithm,
                    updated_at: now,
                },
            });
    }

    await Promise.all(
        requestedMemberIds.map((memberId) =>
            upsertGroupReadState({
                chatId,
                userId: memberId,
                readAt: now,
            })
        )
    );

    const actorName = await getUserDisplayName(sessionUser.id);
    await createAndBroadcastGroupSystemMessage({
        chatId,
        actorUserId: sessionUser.id,
        participantIds: nextParticipantIds,
        event: {
            kind: "group-system",
            action: "member-added",
            actor_user_id: sessionUser.id,
            actor_name: actorName,
            target_user_ids: requestedMemberIds,
            target_names: requestedMemberIds.map((memberId) => {
                const invitedUser = invitedUsers.find(
                    (member) => member.userId === memberId
                );

                return invitedUser?.name || invitedUser?.phoneNumber || memberId;
            }),
        },
    });

    const chat = await getGroupChatForUser({
        chatId,
        userId: sessionUser.id,
    });

    if (!chat) {
        return jsonError("Group not found.", 404);
    }

    await broadcastGroupChatUpdate({
        actorUserId: sessionUser.id,
        chat,
        participantIds: nextParticipantIds,
    });

    return Response.json({ chat });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return jsonError("Unauthorized", 401);
    }

    const { chatId } = await params;
    const sessionUser = session.user as UserSessionShape;
    const canManage = await isGroupAdmin({
        chatId,
        userId: sessionUser.id,
    });

    if (!canManage) {
        return jsonError("Only group admins can manage admins.", 403);
    }

    const body = (await request.json()) as {
        memberUserId?: string;
        isAdmin?: boolean;
    };
    const memberUserId = body.memberUserId?.trim();

    if (!memberUserId || typeof body.isAdmin !== "boolean") {
        return jsonError("Missing member admin fields.", 400);
    }

    const participantIds = await getGroupParticipantIds(chatId);
    if (!participantIds.includes(memberUserId)) {
        return jsonError("Member not found.", 404);
    }

    if (!body.isAdmin) {
        const adminRows = await db
            .select({
                userId: chatRecipientKeys.recipient_user_id,
            })
            .from(chatRecipientKeys)
            .where(
                and(
                    eq(chatRecipientKeys.chat_id, chatId),
                    eq(chatRecipientKeys.is_admin, true)
                )
            );

        if (
            adminRows.length <= 1 &&
            adminRows.some((admin) => admin.userId === memberUserId)
        ) {
            return jsonError("A group must have at least one admin.", 400);
        }
    }

    await db
        .update(chatRecipientKeys)
        .set({
            is_admin: body.isAdmin,
            updated_at: new Date(),
        })
        .where(
            and(
                eq(chatRecipientKeys.chat_id, chatId),
                eq(chatRecipientKeys.recipient_user_id, memberUserId)
            )
        );

    const chat = await getGroupChatForUser({
        chatId,
        userId: sessionUser.id,
    });

    if (!chat) {
        return jsonError("Group not found.", 404);
    }

    await broadcastGroupChatUpdate({
        actorUserId: sessionUser.id,
        chat,
        participantIds: chat.group_members?.map((member) => member.user_id) ?? [],
    });

    return Response.json({ chat });
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return jsonError("Unauthorized", 401);
    }

    const { chatId } = await params;
    const sessionUser = session.user as UserSessionShape;
    const canManage = await isGroupAdmin({
        chatId,
        userId: sessionUser.id,
    });

    if (!canManage) {
        return jsonError("Only group admins can remove members.", 403);
    }

    const body = (await request.json()) as {
        memberUserId?: string;
    };
    const memberUserId = body.memberUserId?.trim();

    if (!memberUserId) {
        return jsonError("Missing member id.", 400);
    }

    if (memberUserId === sessionUser.id) {
        return jsonError("Use exit group to leave the group.", 400);
    }

    const participantIds = await getGroupParticipantIds(chatId);
    if (!participantIds.includes(memberUserId)) {
        return jsonError("Member not found.", 404);
    }

    const [actorName, removedMemberName] = await Promise.all([
        getUserDisplayName(sessionUser.id),
        getUserDisplayName(memberUserId),
    ]);

    await db
        .delete(chatRecipientKeys)
        .where(
            and(
                eq(chatRecipientKeys.chat_id, chatId),
                eq(chatRecipientKeys.recipient_user_id, memberUserId)
            )
        );

    await createAndBroadcastGroupSystemMessage({
        chatId,
        actorUserId: sessionUser.id,
        participantIds,
        event: {
            kind: "group-system",
            action: "member-left",
            actor_user_id: sessionUser.id,
            actor_name: actorName,
            target_user_ids: [memberUserId],
            target_names: [removedMemberName],
        },
    });

    const chat = await getGroupChatForUser({
        chatId,
        userId: sessionUser.id,
    });

    if (!chat) {
        return jsonError("Group not found.", 404);
    }

    await broadcastGroupChatUpdate({
        actorUserId: sessionUser.id,
        chat,
        participantIds: chat.group_members?.map((member) => member.user_id) ?? [],
    });

    return Response.json({ chat });
}

async function getUserDisplayName(userId: string) {
    const [row] = await db
        .select({
            name: user.name,
            phoneNumber: user.phoneNumber,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

    return row?.name || row?.phoneNumber || userId;
}
