import { auth } from "@/lib/auth";
import db from "@/db";
import { chatRecipientKeys, chats, user } from "@/db/schema";
import {
    broadcastGroupChatUpdate,
    createAndBroadcastGroupSystemMessage,
    getGroupChatForUser,
    getGroupParticipantIds,
    isGroupAdmin,
} from "@/lib/group-chat-server";
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";
import { parseManagedProfileImageUrl } from "@/lib/profile-image-url";
import { and, eq } from "drizzle-orm";

type UserSessionShape = {
    id: string;
};

function jsonError(message: string, status: number) {
    return Response.json({ error: message }, { status });
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
    const canEdit = await isGroupAdmin({
        chatId,
        userId: sessionUser.id,
    });

    if (!canEdit) {
        return jsonError("Only group admins can update this group.", 403);
    }

    const body = (await request.json()) as {
        displayName?: string;
        avatar?: string | null;
    };
    const nextDisplayName = body.displayName?.trim();
    const nextAvatar = body.avatar?.trim();
    const [currentChat] = await db
        .select({
            displayName: chats.display_name,
            avatar: chats.avatar,
        })
        .from(chats)
        .where(eq(chats.chat_id, chatId))
        .limit(1);
    const update: Partial<typeof chats.$inferInsert> = {
        updated_at: new Date(),
    };

    if (nextDisplayName !== undefined) {
        if (!nextDisplayName) {
            return jsonError("Group name is required.", 400);
        }

        update.display_name = nextDisplayName;
    }

    if (nextAvatar !== undefined) {
        if (
            nextAvatar &&
            !parseManagedProfileImageUrl(nextAvatar) &&
            !parseManagedMessageMediaUrl(nextAvatar)
        ) {
            return jsonError(
                "Group avatar must use a managed encrypted media route.",
                400
            );
        }

        update.avatar = nextAvatar;
    }

    if (!("display_name" in update) && !("avatar" in update)) {
        return jsonError("No group fields to update.", 400);
    }

    await db.update(chats).set(update).where(eq(chats.chat_id, chatId));

    const participantIds = await getGroupParticipantIds(chatId);
    const actorName = await getUserDisplayName(sessionUser.id);
    const systemMessages = [];

    if (
        "display_name" in update &&
        update.display_name !== currentChat?.displayName
    ) {
        systemMessages.push(
            await createAndBroadcastGroupSystemMessage({
                chatId,
                actorUserId: sessionUser.id,
                participantIds,
                event: {
                    kind: "group-system",
                    action: "name-changed",
                    actor_user_id: sessionUser.id,
                    actor_name: actorName,
                    previous_name: currentChat?.displayName ?? null,
                    next_name: update.display_name ?? null,
                },
            })
        );
    }

    if ("avatar" in update && update.avatar !== currentChat?.avatar) {
        systemMessages.push(
            await createAndBroadcastGroupSystemMessage({
                chatId,
                actorUserId: sessionUser.id,
                participantIds,
                event: {
                    kind: "group-system",
                    action: "image-changed",
                    actor_user_id: sessionUser.id,
                    actor_name: actorName,
                },
            })
        );
    }

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
        participantIds,
    });

    return Response.json({ chat, systemMessages });
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
    const beforeParticipantIds = await getGroupParticipantIds(chatId);
    const actorName = await getUserDisplayName(sessionUser.id);

    if (!beforeParticipantIds.includes(sessionUser.id)) {
        return jsonError("Forbidden", 403);
    }

    await db
        .delete(chatRecipientKeys)
        .where(
            and(
                eq(chatRecipientKeys.chat_id, chatId),
                eq(chatRecipientKeys.recipient_user_id, sessionUser.id)
            )
        );

    const afterMembers = await db
        .select({
            userId: chatRecipientKeys.recipient_user_id,
            isAdmin: chatRecipientKeys.is_admin,
        })
        .from(chatRecipientKeys)
        .where(eq(chatRecipientKeys.chat_id, chatId));

    if (afterMembers.length === 0) {
        await db.delete(chats).where(eq(chats.chat_id, chatId));
        return Response.json({ success: true, removedChat: true });
    }

    const remainingAdmins = afterMembers.filter((member) => member.isAdmin);
    if (remainingAdmins.length === 0) {
        const nextAdmin =
            afterMembers[Math.floor(Math.random() * afterMembers.length)];

        await db
            .update(chatRecipientKeys)
            .set({
                is_admin: true,
                updated_at: new Date(),
            })
            .where(
                and(
                    eq(chatRecipientKeys.chat_id, chatId),
                    eq(
                        chatRecipientKeys.recipient_user_id,
                        nextAdmin.userId
                    )
                )
            );
    }

    await createAndBroadcastGroupSystemMessage({
        chatId,
        actorUserId: sessionUser.id,
        participantIds: beforeParticipantIds,
        event: {
            kind: "group-system",
            action: "member-left",
            actor_user_id: sessionUser.id,
            actor_name: actorName,
            target_user_ids: [sessionUser.id],
            target_names: [actorName],
        },
    });

    const chat = await getGroupChatForUser({
        chatId,
        userId: afterMembers[0].userId,
    });

    if (chat) {
        await broadcastGroupChatUpdate({
            actorUserId: sessionUser.id,
            chat,
            participantIds: beforeParticipantIds,
        });
    }

    return Response.json({ success: true, removedChat: true });
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
