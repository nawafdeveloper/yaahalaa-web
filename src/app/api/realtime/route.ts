import { auth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface UserWithPhone {
    phoneNumber?: string | null;
}

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (request.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
    }

    const userPhone = (session.user as unknown as UserWithPhone).phoneNumber;
    if (!userPhone) {
        return Response.json(
            { error: "Authenticated user has no phone number." },
            { status: 400 }
        );
    }

    const { env } = await getCloudflareContext({ async: true });
    const userDO = env.USER_PRESENCE_DO.get(
        env.USER_PRESENCE_DO.idFromName(userPhone)
    );

    const forwardedRequest = new Request(`https://do/connect?userId=${encodeURIComponent(userPhone)}`, {
        method: request.method,
        headers: request.headers,
    });

    return userDO.fetch(forwardedRequest);
}
