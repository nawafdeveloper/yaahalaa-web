import { auth } from "@/lib/auth";
import { getMessageMediaRuntimeConfig } from "@/lib/message-media-runtime-config";
import {
    logMediaDebug,
    readMediaDebugTraceId,
} from "@/lib/message-media-debug";
import {
    findEncryptedMediaRecord,
    userHasDirectMediaRecipientKey,
    userCanAccessMessageMedia,
} from "@/lib/message-media-access";

async function authorizeMessageMediaAccess(
    request: Request,
    objectKey: string
): Promise<
    | {
          error: Response;
          session?: never;
          mediaRecord?: never;
      }
    | {
          error: null;
          session: NonNullable<
              Awaited<ReturnType<typeof auth.api.getSession>>
          >;
          mediaRecord: NonNullable<Awaited<ReturnType<typeof findEncryptedMediaRecord>>>;
      }
> {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return { error: new Response("Unauthorized", { status: 401 }) };
    }

    const mediaRecord = await findEncryptedMediaRecord(objectKey);
    if (!mediaRecord) {
        return { error: new Response("Message media not found.", { status: 404 }) };
    }

    const isOwner = mediaRecord.ownerId === session.user.id;
    const canAccess =
        isOwner ||
        userHasDirectMediaRecipientKey(mediaRecord.aesKey, session.user.id) ||
        (await userCanAccessMessageMedia(objectKey, session.user.id));

    if (!canAccess) {
        return {
            error: new Response("Unauthorized to access this media.", {
                status: 403,
            }),
        };
    }

    return { error: null, session, mediaRecord };
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

    const authResult = await authorizeMessageMediaAccess(request, objectKey);
    if (authResult.error) {
        logMediaDebug("server.media.access-failed", {
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
        logMediaDebug("server.media.object-missing", {
            debugTraceId: debugTraceId ?? null,
            objectKey,
            userId: authResult.session.user.id,
        });
        return new Response("Message media not found.", { status: 404 });
    }

    const mimeType =
        object.customMetadata?.mimeType ||
        authResult.mediaRecord.mimeType ||
        "application/octet-stream";
    const body = await object.arrayBuffer();

    logMediaDebug("server.media.success", {
        debugTraceId: debugTraceId ?? null,
        objectKey,
        userId: authResult.session.user.id,
        mimeType,
        byteLength: body.byteLength,
    });

    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": mimeType,
            "Cache-Control": "private, max-age=300",
            ETag: object.httpEtag,
        },
    });
}

export async function HEAD(
    request: Request,
    { params }: { params: Promise<{ objectKey: string[] }> }
): Promise<Response> {
    const { objectKey: objectKeySegments } = await params;
    const objectKey = objectKeySegments?.join("/");

    if (!objectKey) {
        return new Response(null, { status: 400 });
    }

    const authResult = await authorizeMessageMediaAccess(request, objectKey);
    if (authResult.error) {
        return new Response(null, { status: authResult.error.status });
    }

    const { bucket } = await getMessageMediaRuntimeConfig();
    if (!bucket) {
        return new Response(null, { status: 500 });
    }

    const object = await bucket.head(objectKey);
    if (!object) {
        return new Response(null, { status: 404 });
    }

    const mimeType =
        object.customMetadata?.mimeType ||
        authResult.mediaRecord.mimeType ||
        "application/octet-stream";

    return new Response(null, {
        status: 200,
        headers: {
            "Content-Type": mimeType,
            "Cache-Control": "private, max-age=300",
            "Content-Length": object.size.toString(),
            ETag: object.httpEtag,
        },
    });
}
