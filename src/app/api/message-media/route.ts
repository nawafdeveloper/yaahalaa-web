import { auth } from "@/lib/auth";
import { getMessageMediaRuntimeConfig } from "@/lib/message-media-runtime-config";
import {
    buildMessageMediaObjectKey,
    buildMessageMediaUrl,
} from "@/lib/message-media-url";
import {
    serializeRecipientMediaKeys,
} from "@/lib/message-media-access";
import db from "@/db";
import { encryptedMedia } from "@/db/schema";

type RecipientKeyInput = {
    recipientUserId: string;
    encryptedAesKey: string;
};

const MESSAGE_MEDIA_MAX_SIZE_BYTES = 100 * 1024 * 1024;

function jsonError(message: string, status: number): Response {
    return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return jsonError("Unauthorized", 401);
    }

    const { bucket } = await getMessageMediaRuntimeConfig();
    if (!bucket) {
        return jsonError("Message media storage bucket is not configured.", 500);
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const iv = formData.get("iv") as string | null;
        const rawRecipientKeys = formData.get("recipientKeys");

        if (!(file instanceof File)) {
            return jsonError("Missing message media file.", 400);
        }

        if (!iv) {
            return jsonError("Missing media encryption IV.", 400);
        }

        if (file.size > MESSAGE_MEDIA_MAX_SIZE_BYTES) {
            return jsonError("Message media exceeds 100 MB limit.", 400);
        }

        const parsedRecipientKeys = JSON.parse(
            typeof rawRecipientKeys === "string" ? rawRecipientKeys : "[]"
        ) as RecipientKeyInput[];
        const recipientKeyMap = Object.fromEntries(
            parsedRecipientKeys
                .filter(
                    (key) => key.recipientUserId && key.encryptedAesKey
                )
                .map((key) => [key.recipientUserId, key.encryptedAesKey])
        );

        if (Object.keys(recipientKeyMap).length === 0) {
            return jsonError(
                "At least one recipient-specific encrypted AES key is required.",
                400
            );
        }

        const objectKey = await buildMessageMediaObjectKey(session.user.id);
        await bucket.put(objectKey, await file.arrayBuffer(), {
            httpMetadata: {
                contentType: file.type || "application/octet-stream",
            },
            customMetadata: {
                mimeType: file.type || "application/octet-stream",
                ownerId: session.user.id,
                encrypted: "true",
                scope: "message-media",
            },
        });

        await db.insert(encryptedMedia).values({
            id: crypto.randomUUID(),
            ownerId: session.user.id,
            objectKey,
            aesKey: serializeRecipientMediaKeys(recipientKeyMap),
            iv,
            mimeType: file.type || "application/octet-stream",
            createdAt: new Date(),
        });

        return Response.json({
            mediaUrl: buildMessageMediaUrl(objectKey),
            objectKey,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Failed to upload encrypted message media.";

        return jsonError(message, 500);
    }
}
