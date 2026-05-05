import db from "@/db";
import { chats, user } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Message } from "@/types/messages.type";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;
const EXPO_PUSH_TOKEN_PATTERN = /^(Expo|Exponent)PushToken\[[^\]]+\]$/;

type MessageForPush = Omit<Message, "created_at" | "updated_at"> & {
    created_at: string | Date;
    updated_at: string | Date;
};

type ExpoPushMessage = {
    to: string;
    sound?: "default";
    title: string;
    body: string;
    data: Record<string, unknown>;
    priority?: "default" | "normal" | "high";
    channelId?: string;
};

type ExpoPushTicket =
    | {
          status: "ok";
          id: string;
      }
    | {
          status: "error";
          message?: string;
          details?: {
              error?: string;
          };
      };

type ExpoPushResponse = {
    data?: ExpoPushTicket | ExpoPushTicket[];
    errors?: unknown[];
};

const ATTACHMENT_LABELS: Record<string, string> = {
    photo: "Photo",
    video: "Video",
    voice: "Voice message",
    file: "Document",
    contact: "Contact",
    location: "Location",
};

export function isExpoPushToken(token?: string | null): token is string {
    return Boolean(token && EXPO_PUSH_TOKEN_PATTERN.test(token.trim()));
}

export async function sendMessagePushNotifications({
    conversationId,
    conversationType,
    message,
    recipientUserIds,
    senderDisplayName,
}: {
    conversationId: string;
    conversationType: "direct" | "group";
    message: MessageForPush;
    recipientUserIds: string[];
    senderDisplayName?: string | null;
}) {
    const uniqueRecipientUserIds = [...new Set(recipientUserIds)].filter(
        (recipientUserId) =>
            recipientUserId && recipientUserId !== message.sender_user_id
    );

    if (uniqueRecipientUserIds.length === 0) {
        return;
    }

    const [chatRow] = await db
        .select({
            isMuted: chats.is_muted_chat_notifications,
        })
        .from(chats)
        .where(eq(chats.chat_id, conversationId))
        .limit(1);

    if (chatRow?.isMuted) {
        return;
    }

    const recipientRows = await db
        .select({
            id: user.id,
            pushToken: user.yhlaPushToken,
            disableMessagesNotifications: user.disableMessagesNotifications,
            disableGroupsNotifications: user.disableGroupsNotifications,
        })
        .from(user)
        .where(inArray(user.id, uniqueRecipientUserIds));

    const pushTargets = recipientRows.filter((recipient) => {
        if (!isExpoPushToken(recipient.pushToken)) {
            return false;
        }

        if (recipient.disableMessagesNotifications) {
            return false;
        }

        return !(
            conversationType === "group" &&
            recipient.disableGroupsNotifications
        );
    });

    if (pushTargets.length === 0) {
        return;
    }

    const title =
        conversationType === "group" ? "New group message" : "New message";
    const preview = getMessageNotificationPreview(message);
    const body =
        conversationType === "group" && senderDisplayName?.trim()
            ? `${senderDisplayName.trim()}: ${preview}`
            : preview;
    const createdAt = toIsoString(message.created_at);
    const pushMessages = pushTargets.map((recipient) => ({
        to: recipient.pushToken,
        sound: "default" as const,
        title,
        body,
        priority: "high" as const,
        channelId: "messages",
        data: {
            type: "NEW_MESSAGE",
            conversationId,
            conversationType,
            messageId: message.message_id,
            senderUserId: message.sender_user_id,
            attachedMedia: message.attached_media,
            createdAt,
        },
    }));
    const tickets = await sendExpoPushNotifications(pushMessages);
    const unregisteredUserIds = tickets
        .map((ticket, index) =>
            ticket?.status === "error" &&
            ticket.details?.error === "DeviceNotRegistered"
                ? pushTargets[index].id
                : null
        )
        .filter((id): id is string => Boolean(id));

    if (unregisteredUserIds.length > 0) {
        await db
            .update(user)
            .set({ yhlaPushToken: "" })
            .where(
                and(
                    inArray(user.id, unregisteredUserIds),
                    inArray(
                        user.yhlaPushToken,
                        pushTargets
                            .filter((target) =>
                                unregisteredUserIds.includes(target.id)
                            )
                            .map((target) => target.pushToken)
                    )
                )
            );
    }
}

async function sendExpoPushNotifications(messages: ExpoPushMessage[]) {
    const tickets: (ExpoPushTicket | null)[] = Array(messages.length).fill(null);
    const accessToken = process.env.EXPO_ACCESS_TOKEN;

    for (let start = 0; start < messages.length; start += EXPO_PUSH_BATCH_SIZE) {
        const chunk = messages.slice(start, start + EXPO_PUSH_BATCH_SIZE);
        const headers = new Headers({
            accept: "application/json",
            "accept-encoding": "gzip, deflate",
            "content-type": "application/json",
        });

        if (accessToken) {
            headers.set("authorization", `Bearer ${accessToken}`);
        }

        try {
            const response = await fetch(EXPO_PUSH_SEND_URL, {
                method: "POST",
                headers,
                body: JSON.stringify(chunk),
            });
            const payload = (await response.json().catch(() => null)) as
                | ExpoPushResponse
                | null;

            if (!response.ok) {
                console.warn("Expo push request failed", {
                    status: response.status,
                    payload,
                });
                continue;
            }

            const responseTickets = Array.isArray(payload?.data)
                ? payload.data
                : payload?.data
                  ? [payload.data]
                  : [];

            responseTickets.forEach((ticket, offset) => {
                tickets[start + offset] = ticket;
            });
        } catch (error) {
            console.warn("Expo push request failed", error);
        }
    }

    return tickets;
}

function getMessageNotificationPreview(message: MessageForPush) {
    if (message.attached_media) {
        return ATTACHMENT_LABELS[message.attached_media] ?? "Attachment";
    }

    return "New message";
}

function toIsoString(value: string | Date) {
    if (typeof value === "string") {
        return value;
    }

    return value.toISOString();
}
