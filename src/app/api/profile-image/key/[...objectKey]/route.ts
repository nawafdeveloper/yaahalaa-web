import { auth } from "@/lib/auth";
import db from "@/db";
import { encryptedMedia } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    // Fetch the media record from database
    const mediaRecord = await db.query.encryptedMedia.findFirst({
        where: eq(encryptedMedia.objectKey, objectKey),
    });

    if (!mediaRecord) {
        return jsonError("Media not found.", 404);
    }

    // Check if user is authorized (owner or contact)
    // For now, only the owner can access their own profile image key
    // TODO: Implement contact checking logic
    if (mediaRecord.ownerId !== session.user.id) {
        return jsonError("Unauthorized to access this media.", 403);
    }

    return Response.json({
        aesKey: mediaRecord.aesKey,
        iv: mediaRecord.iv,
        mimeType: mediaRecord.mimeType,
    });
}
