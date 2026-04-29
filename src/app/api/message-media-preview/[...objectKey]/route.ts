import { auth } from "@/lib/auth";
import { getMessageMediaRuntimeConfig } from "@/lib/message-media-runtime-config";
import {
    logMediaDebug,
    readMediaDebugTraceId,
} from "@/lib/message-media-debug";
import {
    findEncryptedMediaRecordByPreviewObjectKey,
    userHasDirectMediaRecipientKey,
    userCanAccessMessageMedia,
} from "@/lib/message-media-access";

async function authorizePreviewAccess(
    request: Request,
    objectKey: string
): Promise<
    | { error: Response; mediaRecord?: never }
    | {
          error: null;
          mediaRecord: NonNullable<
              Awaited<ReturnType<typeof findEncryptedMediaRecordByPreviewObjectKey>>
          >;
      }
> {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return { error: new Response("Unauthorized", { status: 401 }) };
    }

    const mediaRecord = await findEncryptedMediaRecordByPreviewObjectKey(objectKey);
    if (!mediaRecord) {
        return {
            error: new Response("Message media preview not found.", { status: 404 }),
        };
    }

    const canAccess =
        mediaRecord.ownerId === session.user.id ||
        userHasDirectMediaRecipientKey(mediaRecord.aesKey, session.user.id) ||
        (await userCanAccessMessageMedia(mediaRecord.objectKey, session.user.id));

    if (!canAccess) {
        return {
            error: new Response("Unauthorized to access this media preview.", {
                status: 403,
            }),
        };
    }

    return { error: null, mediaRecord };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ objectKey: string[] }> }
): Promise<Response> {
    const debugTraceId = readMediaDebugTraceId(request);
    const { objectKey: objectKeySegments } = await params;
    const objectKey = objectKeySegments?.join("/");

    if (!objectKey) {
        return new Response("Missing object key.", { status: 400 });
    }

    const authResult = await authorizePreviewAccess(request, objectKey);
    if (authResult.error) {
        logMediaDebug("server.preview.access-failed", {
            debugTraceId: debugTraceId ?? null,
            objectKey,
            status: authResult.error.status,
        });
        return authResult.error;
    }

    const { bucket } = await getMessageMediaRuntimeConfig();
    if (!bucket) {
        return new Response("Message media storage is not configured.", {
            status: 500,
        });
    }

    const object = await bucket.get(objectKey);
    if (!object) {
        logMediaDebug("server.preview.object-missing", {
            debugTraceId: debugTraceId ?? null,
            objectKey,
            userId: authResult.mediaRecord.ownerId,
        });
        return new Response("Message media preview not found.", { status: 404 });
    }

    logMediaDebug("server.preview.success", {
        debugTraceId: debugTraceId ?? null,
        objectKey,
        ownerId: authResult.mediaRecord.ownerId,
        previewMimeType:
            object.customMetadata?.mimeType ||
            authResult.mediaRecord.previewMimeType ||
            "image/jpeg",
    });

    return new Response(await object.arrayBuffer(), {
        status: 200,
        headers: {
            "Content-Type":
                object.customMetadata?.mimeType ||
                authResult.mediaRecord.previewMimeType ||
                "image/jpeg",
            "Cache-Control": "private, max-age=86400",
            ETag: object.httpEtag,
        },
    });
}
