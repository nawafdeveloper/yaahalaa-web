import { auth } from "@/lib/auth";
import db from "@/db";
import { encryptedMedia } from "@/db/schema";
import {
    authorizeProfileImageAccess,
    findProfileImageMediaRecord,
} from "@/lib/profile-image-access";
import {
    parseRecipientMediaKeyMap,
    serializeRecipientMediaKeys,
} from "@/lib/message-media-access";
import { eq } from "drizzle-orm";

type RecipientKeyInput = {
    recipientUserId: string;
    encryptedAesKey: string;
};

function jsonError(message: string, status: number): Response {
    return Response.json(
        { error: message },
        { status },
    );
}

// ---------------------------------------------------------------------------
// GET  /api/profile-image/key/:objectKey
// Returns AES key for authorized users (owner or contacts).
// ---------------------------------------------------------------------------

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

    const mediaRecord = await findProfileImageMediaRecord(objectKey);

    if (!mediaRecord) {
        return jsonError("Media not found.", 404);
    }

    const access = await authorizeProfileImageAccess({
        mediaRecord,
        requesterUserId: session.user.id,
    });

    if (!access.canAccess || !access.encryptedAesKey) {
        return jsonError("Unauthorized to access this media.", 403);
    }

    return Response.json({
        aesKey: access.encryptedAesKey,
        iv: mediaRecord.iv,
        mimeType: mediaRecord.mimeType,
    });
}

export async function PATCH(
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

    const mediaRecord = await findProfileImageMediaRecord(objectKey);
    if (!mediaRecord) {
        return jsonError("Media not found.", 404);
    }

    if (mediaRecord.ownerId !== session.user.id) {
        return jsonError("Only the profile image owner can share this key.", 403);
    }

    const body = (await request.json()) as {
        recipientKeys?: RecipientKeyInput[];
    };
    const nextRecipientKeys = Object.fromEntries(
        (body.recipientKeys ?? [])
            .filter((key) => key.recipientUserId && key.encryptedAesKey)
            .map((key) => [key.recipientUserId, key.encryptedAesKey])
    );

    if (Object.keys(nextRecipientKeys).length === 0) {
        return jsonError("Missing recipient keys.", 400);
    }

    const existingKeyMap = parseRecipientMediaKeyMap(mediaRecord.aesKey)?.keys ?? {
        [session.user.id]: mediaRecord.aesKey,
    };
    const mergedKeyMap = {
        ...existingKeyMap,
        ...nextRecipientKeys,
    };

    await db
        .update(encryptedMedia)
        .set({
            aesKey: serializeRecipientMediaKeys(mergedKeyMap),
        })
        .where(eq(encryptedMedia.objectKey, objectKey));

    return Response.json({
        success: true,
        recipientKeyCount: Object.keys(mergedKeyMap).length,
    });
}
