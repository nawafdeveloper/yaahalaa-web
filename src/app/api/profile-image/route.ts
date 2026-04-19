import { auth } from "@/lib/auth";
import { getProfileImageRuntimeConfig } from "@/lib/profile-image-runtime-config";
import {
    buildProfileImageObjectKey,
    buildProfileImageUrl,
} from "@/lib/profile-image-url";
import db from "@/db";
import { encryptedMedia } from "@/db/schema";
import { nanoid } from "nanoid";

const PROFILE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_ACCEPTED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
];

function jsonError(message: string, status: number): Response {
    return Response.json(
        { error: message },
        { status },
    );
}

// ---------------------------------------------------------------------------
// POST  /api/profile-image
// Receives an encrypted profile image file and stores it in R2.
// The client should encrypt the image with a random AES-256-GCM key before sending.
// The AES key is stored in the database for authorized access.
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return jsonError("Unauthorized", 401);
    }

    const { bucket } = await getProfileImageRuntimeConfig();

    if (!bucket) {
        return jsonError("Profile image storage bucket is not configured.", 500);
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const aesKey = formData.get("aesKey") as string;
        const iv = formData.get("iv") as string;

        if (!(file instanceof File)) {
            return jsonError("Missing profile image file.", 400);
        }

        if (!aesKey || !iv) {
            return jsonError("Missing encryption parameters (aesKey or iv).", 400);
        }

        if (file.size > PROFILE_IMAGE_MAX_SIZE_BYTES) {
            return jsonError("Profile image exceeds 5 MB limit.", 400);
        }

        if (!PROFILE_IMAGE_ACCEPTED_MIME_TYPES.includes(file.type)) {
            return jsonError("Unsupported profile image type.", 400);
        }

        const objectKey = await buildProfileImageObjectKey(session.user.id);

        await bucket.put(objectKey, await file.arrayBuffer(), {
            httpMetadata: {
                contentType: file.type,
            },
            customMetadata: {
                mimeType: file.type,
                ownerId: session.user.id,
                originalSize: String(file.size),
                encrypted: "true",
            },
        });

        // Store AES key in database
        const mediaId = nanoid();
        await db.insert(encryptedMedia).values({
            id: mediaId,
            ownerId: session.user.id,
            objectKey,
            aesKey,
            iv,
            mimeType: file.type,
        });

        return Response.json({
            imageUrl: buildProfileImageUrl(objectKey),
            mediaId,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Failed to upload profile image.";

        return jsonError(message, 500);
    }
}
