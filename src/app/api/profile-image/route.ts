import { auth } from "@/lib/auth";
import {
    decryptProfileImageBuffer,
    isSupportedProfileImageType,
    PROFILE_IMAGE_MAX_SIZE_BYTES,
    PROFILE_IMAGE_VERSION,
    unwrapProfileImageKey,
    wrapProfileImageKey,
} from "@/lib/profile-image-crypto";
import { getProfileImageRuntimeConfig } from "@/lib/profile-image-runtime-config";
import {
    buildProfileImageObjectKey,
    buildProfileImageUrl,
} from "@/lib/profile-image-url";

function jsonError(message: string, status: number): Response {
    return Response.json(
        { error: message },
        { status },
    );
}

function requireStringField(
    value: FormDataEntryValue | null,
    fieldName: string,
): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Missing required field: ${fieldName}`);
    }

    return value;
}

export async function POST(request: Request): Promise<Response> {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return jsonError("Unauthorized", 401);
    }

    const { bucket, masterKey } = await getProfileImageRuntimeConfig();

    if (!bucket) {
        return jsonError("Profile image storage bucket is not configured.", 500);
    }

    if (!masterKey) {
        return jsonError("Profile image encryption secret is not configured.", 500);
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const key = requireStringField(formData.get("key"), "key");
        const iv = requireStringField(formData.get("iv"), "iv");
        const mimeType = requireStringField(formData.get("mimeType"), "mimeType");
        const version = requireStringField(formData.get("version"), "version");
        const originalSizeValue = requireStringField(formData.get("originalSize"), "originalSize");
        const originalSize = Number(originalSizeValue);

        if (!(file instanceof File)) {
            return jsonError("Missing encrypted profile image file.", 400);
        }

        if (!Number.isFinite(originalSize) || originalSize <= 0) {
            return jsonError("Invalid original image size.", 400);
        }

        if (originalSize > PROFILE_IMAGE_MAX_SIZE_BYTES) {
            return jsonError("Profile image exceeds the 5 MB limit.", 400);
        }

        if (!isSupportedProfileImageType(mimeType)) {
            return jsonError("Unsupported profile image type.", 400);
        }

        if (version !== PROFILE_IMAGE_VERSION) {
            return jsonError("Unsupported profile image encryption version.", 400);
        }

        const objectKey = buildProfileImageObjectKey(session.user.id);
        const { wrappedKey, wrappedKeyIv } = await wrapProfileImageKey(key, masterKey);

        await bucket.put(objectKey, await file.arrayBuffer(), {
            httpMetadata: {
                contentType: "application/octet-stream",
            },
            customMetadata: {
                encryptedKey: wrappedKey,
                encryptedKeyIv: wrappedKeyIv,
                fileIv: iv,
                mimeType,
                version,
                ownerId: session.user.id,
                originalSize: String(originalSize),
            },
        });

        return Response.json({
            imageUrl: buildProfileImageUrl(session.user.id, objectKey),
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Failed to upload encrypted profile image.";

        return jsonError(message, 500);
    }
}

export async function GET(request: Request): Promise<Response> {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { bucket, masterKey } = await getProfileImageRuntimeConfig();

    if (!bucket || !masterKey) {
        return new Response("Profile image storage is not configured.", { status: 500 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const objectKey = url.searchParams.get("objectKey");

    if (!userId || !objectKey) {
        return new Response("Missing required query parameters.", { status: 400 });
    }

    if (!objectKey.startsWith(`profiles/${userId}/`)) {
        return new Response("Invalid profile image object key.", { status: 400 });
    }

    const object = await bucket.get(objectKey);

    if (!object) {
        return new Response("Profile image not found.", { status: 404 });
    }

    const metadata = object.customMetadata;
    const encryptedKey = metadata?.encryptedKey;
    const encryptedKeyIv = metadata?.encryptedKeyIv;
    const fileIv = metadata?.fileIv;
    const mimeType = metadata?.mimeType;
    const version = metadata?.version;

    if (!encryptedKey || !encryptedKeyIv || !fileIv || !mimeType || !version) {
        return new Response("Profile image metadata is incomplete.", { status: 500 });
    }

    if (version !== PROFILE_IMAGE_VERSION) {
        return new Response("Unsupported profile image encryption version.", { status: 500 });
    }

    const decryptedKey = await unwrapProfileImageKey(encryptedKey, encryptedKeyIv, masterKey);
    const decryptedImage = await decryptProfileImageBuffer(
        await object.arrayBuffer(),
        decryptedKey,
        fileIv,
    );

    return new Response(decryptedImage, {
        status: 200,
        headers: {
            "Content-Type": mimeType,
            "Cache-Control": "private, max-age=60",
            ETag: object.httpEtag,
        },
    });
}
