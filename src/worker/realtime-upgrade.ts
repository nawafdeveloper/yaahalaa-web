import { auth } from "@/lib/auth";

interface SessionUser {
    id: string;
    phoneNumber?: string | null;
}

type RealtimeWorkerEnv = {
    USER_PRESENCE_DO: DurableObjectNamespace;
};

export async function handleRealtimeUpgrade(
    request: Request,
    env: RealtimeWorkerEnv
): Promise<Response | null> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("upgrade");

    if (
        url.pathname !== "/api/realtime" ||
        upgradeHeader?.toLowerCase() !== "websocket"
    ) {
        return null;
    }

    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    let sessionUserId = (session?.user as SessionUser | undefined)?.id ?? null;
    let userPhone = (session?.user as SessionUser | undefined)?.phoneNumber ?? null;

    if (!sessionUserId || !userPhone) {
        sessionUserId = url.searchParams.get("userId");
        userPhone = url.searchParams.get("phone");
    }

    if (!sessionUserId || !userPhone) {
        return Response.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const userDO = env.USER_PRESENCE_DO.get(
        env.USER_PRESENCE_DO.idFromName(sessionUserId)
    );

    const forwardedRequest = new Request(
        `https://do/connect?userId=${encodeURIComponent(sessionUserId)}&phone=${encodeURIComponent(userPhone)}`,
        {
            method: request.method,
            headers: request.headers,
        }
    );

    return userDO.fetch(forwardedRequest);
}
