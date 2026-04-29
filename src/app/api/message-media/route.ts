import { auth } from "@/lib/auth";
import { getMessageMediaRuntimeConfig } from "@/lib/message-media-runtime-config";
import {
    logMediaDebug,
    readMediaDebugTraceId,
} from "@/lib/message-media-debug";
import {
    buildMessageMediaObjectKey,
    buildMessageMediaPreviewObjectKey,
    buildMessageMediaPreviewUrl,
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
    const debugTraceId = readMediaDebugTraceId(request);
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
        const previewFile = formData.get("previewFile");
        const iv = formData.get("iv") as string | null;
        const rawRecipientKeys = formData.get("recipientKeys");
        const rawOriginalSizeBytes = formData.get("originalSizeBytes");

        if (!(file instanceof File)) {
            return jsonError("Missing message media file.", 400);
        }

        if (!iv) {
            return jsonError("Missing media encryption IV.", 400);
        }

        if (file.size > MESSAGE_MEDIA_MAX_SIZE_BYTES) {
            return jsonError("Message media exceeds 100 MB limit.", 400);
        }

        const originalSizeBytes = Number(
            typeof rawOriginalSizeBytes === "string"
                ? rawOriginalSizeBytes
                : file.size
        );

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

        logMediaDebug("server.upload.request", {
            debugTraceId: debugTraceId ?? null,
            userId: session.user.id,
            fileName: file.name,
            fileType: file.type || null,
            encryptedSize: file.size,
            hasPreviewFile: previewFile instanceof File,
            previewSize:
                previewFile instanceof File ? previewFile.size : null,
            recipientKeyCount: Object.keys(recipientKeyMap).length,
            originalSizeBytes: Number.isFinite(originalSizeBytes)
                ? originalSizeBytes
                : file.size,
        });

        const objectKey = await buildMessageMediaObjectKey(session.user.id);
        const previewObjectKey =
            previewFile instanceof File
                ? await buildMessageMediaPreviewObjectKey(session.user.id)
                : null;
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

        if (previewObjectKey && previewFile instanceof File) {
            await bucket.put(previewObjectKey, await previewFile.arrayBuffer(), {
                httpMetadata: {
                    contentType: previewFile.type || "image/jpeg",
                },
                customMetadata: {
                    mimeType: previewFile.type || "image/jpeg",
                    ownerId: session.user.id,
                    encrypted: "false",
                    scope: "message-media-preview",
                },
            });
        }

        await db.insert(encryptedMedia).values({
            id: crypto.randomUUID(),
            ownerId: session.user.id,
            objectKey,
            previewObjectKey,
            aesKey: serializeRecipientMediaKeys(recipientKeyMap),
            iv,
            mimeType: file.type || "application/octet-stream",
            previewMimeType:
                previewFile instanceof File ? previewFile.type || "image/jpeg" : null,
            originalSizeBytes: Number.isFinite(originalSizeBytes)
                ? originalSizeBytes
                : file.size,
            createdAt: new Date(),
        });

        logMediaDebug("server.upload.success", {
            debugTraceId: debugTraceId ?? null,
            userId: session.user.id,
            objectKey,
            previewObjectKey,
            previewMimeType:
                previewFile instanceof File ? previewFile.type || "image/jpeg" : null,
        });

        return Response.json({
            mediaUrl: buildMessageMediaUrl(objectKey),
            previewUrl: previewObjectKey
                ? buildMessageMediaPreviewUrl(previewObjectKey)
                : null,
            sizeBytes: Number.isFinite(originalSizeBytes)
                ? originalSizeBytes
                : file.size,
            objectKey,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Failed to upload encrypted message media.";

        logMediaDebug("server.upload.error", {
            debugTraceId: debugTraceId ?? null,
            error: message,
        });

        return jsonError(message, 500);
    }
}
