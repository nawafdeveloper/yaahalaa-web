import { auth } from "@/lib/auth";
import {
    findEncryptedMediaRecord,
    resolveRecipientMediaKeyForUser,
    userCanAccessMessageMedia,
} from "@/lib/message-media-access";

function jsonError(message: string, status: number): Response {
    return Response.json({ error: message }, { status });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ objectKey: string[] }> }
): Promise<Response> {
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
        return jsonError("Media not found.", 404);
    }

    const isOwner = mediaRecord.ownerId === session.user.id;
    const canAccess =
        isOwner ||
        (await userCanAccessMessageMedia(objectKey, session.user.id));

    if (!canAccess) {
        return jsonError("Unauthorized to access this media.", 403);
    }

    const encryptedAesKey = resolveRecipientMediaKeyForUser(
        mediaRecord.aesKey,
        session.user.id
    );

    if (!encryptedAesKey) {
        return jsonError(
            "No encrypted media key is available for the current user.",
            403
        );
    }

    return Response.json({
        aesKey: encryptedAesKey,
        iv: mediaRecord.iv,
        mimeType: mediaRecord.mimeType,
    });
}
