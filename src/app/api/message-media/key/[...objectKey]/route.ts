import { auth } from "@/lib/auth";
import {
    findEncryptedMediaRecord,
    resolveRecipientMediaKeyForUser,
    userHasDirectMediaRecipientKey,
    userCanAccessMessageMedia,
} from "@/lib/message-media-access";
import {
    logMediaDebug,
    readMediaDebugTraceId,
} from "@/lib/message-media-debug";

function jsonError(message: string, status: number): Response {
    return Response.json({ error: message }, { status });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ objectKey: string[] }> }
): Promise<Response> {
    const debugTraceId = readMediaDebugTraceId(request);
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return jsonError("Unauthorized", 401);
    }

    const { objectKey: objectKeySegments } = await params;
    const objectKey = objectKeySegments?.join("/");

    if (!objectKey) {
        return jsonError("Missing object key.", 400);
    }

    const mediaRecord = await findEncryptedMediaRecord(objectKey);
    if (!mediaRecord) {
        logMediaDebug("server.media-key.not-found", {
            debugTraceId: debugTraceId ?? null,
            objectKey,
        });
        return jsonError("Media not found.", 404);
    }

    const isOwner = mediaRecord.ownerId === session.user.id;
    const canAccess =
        isOwner ||
        userHasDirectMediaRecipientKey(mediaRecord.aesKey, session.user.id) ||
        (await userCanAccessMessageMedia(objectKey, session.user.id));

    if (!canAccess) {
        logMediaDebug("server.media-key.unauthorized", {
            debugTraceId: debugTraceId ?? null,
            objectKey,
            userId: session.user.id,
            isOwner,
        });
        return jsonError("Unauthorized to access this media.", 403);
    }

    const encryptedAesKey = resolveRecipientMediaKeyForUser(
        mediaRecord.aesKey,
        session.user.id
    );

    if (!encryptedAesKey) {
        logMediaDebug("server.media-key.missing-user-key", {
            debugTraceId: debugTraceId ?? null,
            objectKey,
            userId: session.user.id,
        });
        return jsonError(
            "No encrypted media key is available for the current user.",
            403
        );
    }

    logMediaDebug("server.media-key.success", {
        debugTraceId: debugTraceId ?? null,
        objectKey,
        userId: session.user.id,
        mimeType: mediaRecord.mimeType,
        isOwner,
    });

    return Response.json({
        aesKey: encryptedAesKey,
        iv: mediaRecord.iv,
        mimeType: mediaRecord.mimeType,
    });
}
