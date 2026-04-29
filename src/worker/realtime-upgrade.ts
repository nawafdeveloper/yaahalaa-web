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

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as SessionUser;
    const userPhone = sessionUser.phoneNumber;
    if (!userPhone) {
        return Response.json(
            { error: "Authenticated user has no phone number." },
            { status: 400 }
        );
    }

    const userDO = env.USER_PRESENCE_DO.get(
        env.USER_PRESENCE_DO.idFromName(sessionUser.id)
    );

    const forwardedRequest = new Request(
        `https://do/connect?userId=${encodeURIComponent(sessionUser.id)}&phone=${encodeURIComponent(userPhone)}`,
        {
            method: request.method,
            headers: request.headers,
        }
    );

    return userDO.fetch(forwardedRequest);
}
