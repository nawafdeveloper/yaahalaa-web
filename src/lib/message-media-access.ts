import db from "@/db";
import { encryptedMedia, message, messageRecipientKeys } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { buildMessageMediaUrl } from "./message-media-url";

type SerializedRecipientMediaKeys = {
    version: 1;
    keys: Record<string, string>;
};

function parseRecipientMediaKeyMap(
    storedValue: string
): SerializedRecipientMediaKeys | null {
    if (!storedValue) {
        return null;
    }

    try {
        const parsed = JSON.parse(storedValue) as Partial<SerializedRecipientMediaKeys>;
        if (
            parsed.version === 1 &&
            parsed.keys &&
            typeof parsed.keys === "object"
        ) {
            return {
                version: 1,
                keys: parsed.keys,
            };
        }
    } catch {
        return null;
    }

    return null;
}

export function serializeRecipientMediaKeys(
    keys: Record<string, string>
): string {
    return JSON.stringify({
        version: 1,
        keys,
    } satisfies SerializedRecipientMediaKeys);
}

export function resolveRecipientMediaKeyForUser(
    storedValue: string,
    userId: string
): string | null {
    if (!storedValue || !userId) {
        return null;
    }

    const parsed = parseRecipientMediaKeyMap(storedValue);
    if (parsed) {
        return parsed.keys[userId] ?? null;
    }

    if (storedValue) {
        return storedValue;
    }

    return null;
}

export async function findEncryptedMediaRecord(objectKey: string) {
    return db.query.encryptedMedia.findFirst({
        where: eq(encryptedMedia.objectKey, objectKey),
    });
}

export async function findEncryptedMediaRecordByPreviewObjectKey(
    previewObjectKey: string
) {
    return db.query.encryptedMedia.findFirst({
        where: eq(encryptedMedia.previewObjectKey, previewObjectKey),
    });
}

export async function userCanAccessMessageMedia(
    objectKey: string,
    userId: string
): Promise<boolean> {
    if (!objectKey || !userId) {
        return false;
    }

    const managedMediaUrl = buildMessageMediaUrl(objectKey);
    const linkedMessage = await db.query.message.findFirst({
        where: or(
            eq(message.media_url, managedMediaUrl),
            eq(message.video_thumbnail, managedMediaUrl)
        ),
        columns: {
            message_id: true,
            sender_user_id: true,
        },
    });

    if (!linkedMessage) {
        return false;
    }

    if (linkedMessage.sender_user_id === userId) {
        return true;
    }

    const recipientKey = await db.query.messageRecipientKeys.findFirst({
        where: and(
            eq(messageRecipientKeys.message_id, linkedMessage.message_id),
            eq(messageRecipientKeys.recipient_user_id, userId)
        ),
        columns: {
            id: true,
        },
    });

    return Boolean(recipientKey);
}

export function userHasDirectMediaRecipientKey(
    storedValue: string,
    userId: string
): boolean {
    const parsed = parseRecipientMediaKeyMap(storedValue);
    return Boolean(parsed?.keys[userId]);
}
