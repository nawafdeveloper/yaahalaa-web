import db from "@/db";
import { chatUserSettings, user } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { Message } from "@/types/messages.type";

const MESSAGE_NOTIFICATION_CATEGORY_ID = "message";
const MESSAGE_NOTIFICATION_PREVIEW_MAX_LENGTH = 240;
const FCM_BATCH_SIZE = 100;

// FCM V1 endpoint — requires your Firebase project ID
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;

type MessageForPush = Omit<Message, "created_at" | "updated_at"> & {
    created_at: string | Date;
    updated_at: string | Date;
};

type FCMMessage = {
    message: {
        token: string;
        data: Record<string, string>; // FCM data payload — all values must be strings
        android: {
            priority: "HIGH" | "NORMAL";
        };
        apns?: {
            headers?: Record<string, string>;
        };
    };
};

type FCMResponse = {
    name?: string;   // success: "projects/.../messages/..."
    error?: {
        code: number;
        message: string;
        status: string;
        details?: { errorCode?: string }[];
    };
};

const ATTACHMENT_LABELS: Record<string, string> = {
    photo: "📷 Photo",
    video: "📹 Video",
    voice: "🎤 Voice message",
    file: "📄 Document",
    contact: "👤 Contact",
    location: "📍 Location",
};

// ─── Token validation ─────────────────────────────────────────────────────────
// FCM tokens are long alphanumeric strings, not Expo tokens
export function isFCMToken(token?: string | null): token is string {
    if (!token || token.trim().length < 100) return false;
    // FCM tokens don't start with ExponentPushToken
    if (token.startsWith("ExponentPushToken") || token.startsWith("ExpoPushToken")) return false;
    return true;
}

// Keep for backwards compat if some users still have old Expo tokens in DB
export function isExpoPushToken(token?: string | null): token is string {
    return Boolean(
        token &&
        /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token.trim())
    );
}

// ─── FCM access token (cached) ────────────────────────────────────────────────
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getFCMAccessToken(): Promise<string> {
    if (cachedAccessToken && Date.now() < tokenExpiresAt) {
        return cachedAccessToken;
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);

    // Build JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    };

    const encode = (obj: object) =>
        Buffer.from(JSON.stringify(obj))
            .toString("base64")
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");

    const signingInput = `${encode(header)}.${encode(payload)}`;

    // Sign with RSA private key using Web Crypto
    const privateKeyPem = serviceAccount.private_key;
    const pemContents = privateKeyPem
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\n/g, "");
    const keyBuffer = Buffer.from(pemContents, "base64");

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        Buffer.from(signingInput)
    );

    const jwt = `${signingInput}.${Buffer.from(signature)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    const tokenData = await tokenResponse.json() as {
        access_token: string;
        expires_in: number;
    };

    cachedAccessToken = tokenData.access_token;
    tokenExpiresAt = Date.now() + (tokenData.expires_in - 60) * 1000; // refresh 1min early

    return cachedAccessToken;
}

// ─── Main function ────────────────────────────────────────────────────────────
export async function sendMessagePushNotifications({
    conversationId,
    conversationType,
    message,
    notificationPlaintext,
    recipientUserIds,
    senderAvatarUrl,
    senderDisplayName,
}: {
    conversationId: string;
    conversationType: "direct" | "group";
    message: MessageForPush;
    notificationPlaintext?: string | null;
    recipientUserIds: string[];
    senderAvatarUrl?: string | null;
    senderDisplayName?: string | null;
}) {
    const uniqueRecipientUserIds = [...new Set(recipientUserIds)].filter(
        (recipientUserId) =>
            recipientUserId && recipientUserId !== message.sender_user_id
    );

    if (uniqueRecipientUserIds.length === 0) {
        return;
    }

    const mutedRecipientRows = await db
        .select({ userId: chatUserSettings.user_id })
        .from(chatUserSettings)
        .where(
            and(
                eq(chatUserSettings.chat_id, conversationId),
                inArray(chatUserSettings.user_id, uniqueRecipientUserIds),
                eq(chatUserSettings.is_muted_chat_notifications, true)
            )
        );
    const mutedRecipientUserIds = new Set(
        mutedRecipientRows.map((row) => row.userId)
    );

    const recipientRows = await db
        .select({
            id: user.id,
            pushToken: user.yhlaPushToken,
            disableMessagesNotifications: user.disableMessagesNotifications,
            disableGroupsNotifications: user.disableGroupsNotifications,
        })
        .from(user)
        .where(inArray(user.id, uniqueRecipientUserIds));

    const [senderRow] = await db
        .select({ image: user.image, name: user.name })
        .from(user)
        .where(eq(user.id, message.sender_user_id))
        .limit(1);

    // Accept both FCM tokens and old Expo tokens during migration period
    const pushTargets = recipientRows.filter((recipient) => {
        if (mutedRecipientUserIds.has(recipient.id)) {
            return false;
        }
        if (!isFCMToken(recipient.pushToken) && !isExpoPushToken(recipient.pushToken)) {
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

    const senderName = senderDisplayName?.trim() || senderRow?.name?.trim() || null;
    const title =
        senderName ??
        (conversationType === "group" ? "New group message" : "New message");
    const preview = getMessageNotificationPreview(message, notificationPlaintext);
    const createdAt = toIsoString(message.created_at);

    // FCM data payload — all values MUST be strings
    const dataPayload: Record<string, string> = {
        type: MESSAGE_NOTIFICATION_CATEGORY_ID,
        eventType: "NEW_MESSAGE",
        conversationId,
        conversationType,
        messageId: message.message_id,
        senderUserId: message.sender_user_id,
        senderDisplayName: senderName ?? "",
        senderAvatarUrl: senderAvatarUrl ?? senderRow?.image ?? "",
        title,
        body: preview,
        messagePreview: preview,
        attachedMedia: message.attached_media ?? "",
        createdAt,
        channelId: "messages",
        sound: "default",
    };

    // Split into FCM and legacy Expo targets
    const fcmTargets = pushTargets.filter((t) => isFCMToken(t.pushToken));
    const expoTargets = pushTargets.filter((t) => isExpoPushToken(t.pushToken));

    // Send FCM
    if (fcmTargets.length > 0) {
        const unregisteredIds = await sendFCMNotifications(
            fcmTargets.map((t) => t.pushToken as string),
            dataPayload
        );

        if (unregisteredIds.length > 0) {
            const unregisteredUserIds = fcmTargets
                .filter((t) => unregisteredIds.includes(t.pushToken as string))
                .map((t) => t.id);

            await db
                .update(user)
                .set({ yhlaPushToken: "" })
                .where(
                    and(
                        inArray(user.id, unregisteredUserIds),
                        inArray(
                            user.yhlaPushToken,
                            unregisteredIds
                        )
                    )
                );
        }
    }

    // Send legacy Expo push (for users who haven't re-registered yet)
    if (expoTargets.length > 0) {
        await sendLegacyExpoPushNotifications(
            expoTargets.map((t) => ({
                to: t.pushToken as string,
                sound: "default" as const,
                title,
                body: preview,
                priority: "high" as const,
                channelId: "messages",
                data: dataPayload,
            }))
        );
    }
}

// ─── FCM V1 send ──────────────────────────────────────────────────────────────
async function sendFCMNotifications(
    tokens: string[],
    data: Record<string, string>
): Promise<string[]> {
    const unregisteredTokens: string[] = [];

    let accessToken: string;
    try {
        accessToken = await getFCMAccessToken();
    } catch (error) {
        console.error("[fcm] Failed to get access token:", error);
        return unregisteredTokens;
    }

    // FCM V1 sends one message per token (no batch endpoint)
    // Process in chunks to avoid overwhelming the server
    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
        const chunk = tokens.slice(i, i + FCM_BATCH_SIZE);

        await Promise.all(
            chunk.map(async (token) => {
                const fcmMessage: FCMMessage = {
                    message: {
                        token,
                        data,
                        android: {
                            priority: "HIGH",
                        },
                        apns: {
                            headers: {
                                "apns-priority": "10",
                            },
                        },
                    },
                };

                try {
                    const response = await fetch(FCM_URL, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(fcmMessage),
                    });

                    const result = await response.json() as FCMResponse;

                    if (!response.ok) {
                        const errorCode = result.error?.details?.[0]?.errorCode;
                        if (
                            errorCode === "UNREGISTERED" ||
                            errorCode === "INVALID_ARGUMENT"
                        ) {
                            unregisteredTokens.push(token);
                        } else {
                            console.warn("[fcm] Send failed for token:", {
                                token: token.slice(0, 20) + "...",
                                error: result.error,
                            });
                        }
                    }
                } catch (error) {
                    console.warn("[fcm] Request threw for token:", error);
                }
            })
        );
    }

    return unregisteredTokens;
}

// ─── Legacy Expo push (keep during migration) ─────────────────────────────────
type ExpoPushMessage = {
    to: string;
    sound?: "default";
    title: string;
    body: string;
    data: Record<string, unknown>;
    priority?: "high";
    channelId?: string;
};

async function sendLegacyExpoPushNotifications(messages: ExpoPushMessage[]) {
    const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
    const accessToken = process.env.EXPO_ACCESS_TOKEN;

    for (let start = 0; start < messages.length; start += FCM_BATCH_SIZE) {
        const chunk = messages.slice(start, start + FCM_BATCH_SIZE);
        const headers = new Headers({
            accept: "application/json",
            "accept-encoding": "gzip, deflate",
            "content-type": "application/json",
        });

        if (accessToken) {
            headers.set("authorization", `Bearer ${accessToken}`);
        }

        try {
            await fetch(EXPO_PUSH_SEND_URL, {
                method: "POST",
                headers,
                body: JSON.stringify(chunk),
            });
        } catch (error) {
            console.warn("[expo-push] Legacy send failed:", error);
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMessageNotificationPreview(
    message: MessageForPush,
    notificationPlaintext?: string | null
) {
    const plaintextPreview = normalizeNotificationPlaintext(notificationPlaintext);
    if (plaintextPreview) return plaintextPreview;

    const messageTextPreview = normalizeNotificationPlaintext(
        message.message_text_content
    );
    if (messageTextPreview) return messageTextPreview;

    if (message.attached_media === "contact" && message.contact?.contact_name) {
        return `Contact: ${message.contact.contact_name}`;
    }

    if (message.attached_media) {
        return ATTACHMENT_LABELS[message.attached_media] ?? "📎 Attachment";
    }

    return "New message";
}

function normalizeNotificationPlaintext(value?: string | null) {
    const text = value?.trim();
    if (!text) return null;
    if (text.length <= MESSAGE_NOTIFICATION_PREVIEW_MAX_LENGTH) return text;
    return `${text.slice(0, MESSAGE_NOTIFICATION_PREVIEW_MAX_LENGTH).trimEnd()}...`;
}

function toIsoString(value: string | Date) {
    if (typeof value === "string") return value;
    return value.toISOString();
}
