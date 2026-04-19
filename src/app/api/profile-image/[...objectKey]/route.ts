import { auth } from "@/lib/auth";
import { getProfileImageRuntimeConfig } from "@/lib/profile-image-runtime-config";
import db from "@/db";
import { encryptedMedia } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// GET  /api/profile-image/:objectKey
// Serves encrypted profile image from R2.
// The client must fetch the AES key separately to decrypt the image.
// ---------------------------------------------------------------------------

export async function GET(
    request: Request,
    { params }: { params: Promise<{ objectKey: string[] }> }
): Promise<Response> {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { bucket } = await getProfileImageRuntimeConfig();

    if (!bucket) {
        return new Response("Profile image storage is not configured.", { status: 500 });
    }

    const { objectKey: objectKeySegments } = await params;
    const objectKey = objectKeySegments?.join("/");

    if (!objectKey) {
        return new Response("Missing object key.", { status: 400 });
    }

    // Verify the media exists and user has access
    const mediaRecord = await db.query.encryptedMedia.findFirst({
        where: eq(encryptedMedia.objectKey, objectKey),
    });

    if (!mediaRecord) {
        return new Response("Profile image not found.", { status: 404 });
    }

    // Check if user is authorized (owner or contact)
    // For now, only the owner can access their own profile image
    // TODO: Implement contact checking logic
    if (mediaRecord.ownerId !== session.user.id) {
        return new Response("Unauthorized to access this media.", { status: 403 });
    }

    const object = await bucket.get(objectKey);

    if (!object) {
        return new Response("Profile image not found.", { status: 404 });
    }

    const metadata = object.customMetadata;
    const mimeType = metadata?.mimeType || "application/octet-stream";

    const body = await object.arrayBuffer();

    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": mimeType,
            "Cache-Control": "private, max-age=300",
            ETag: object.httpEtag,
        },
    });
}
