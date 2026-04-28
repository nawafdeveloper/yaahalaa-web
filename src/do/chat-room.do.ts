import { DurableObject } from "cloudflare:workers";

type BroadcastEvent = {
    type: string;
    [key: string]: unknown;
};

type UserPayload = {
    userId?: string;
};

type DurableBindingsEnv = {
    USER_PRESENCE_DO: DurableObjectNamespace;
};

export class ChatRoomDO extends DurableObject<DurableBindingsEnv> {
    private activeUsers = new Set<string>();

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        switch (url.pathname) {
            case "/broadcast": {
                const event = (await request.json()) as BroadcastEvent;
                await this.broadcast(event);
                return Response.json({ ok: true });
            }

            case "/user-joined": {
                const { userId } = (await request.json()) as UserPayload;
                if (!userId) {
                    return Response.json(
                        { error: "userId is required" },
                        { status: 400 }
                    );
                }

                this.activeUsers.add(userId);
                return Response.json({
                    ok: true,
                    activeUsers: this.activeUsers.size,
                });
            }

            case "/user-left": {
                const { userId } = (await request.json()) as UserPayload;
                if (!userId) {
                    return Response.json(
                        { error: "userId is required" },
                        { status: 400 }
                    );
                }

                this.activeUsers.delete(userId);
                return Response.json({
                    ok: true,
                    activeUsers: this.activeUsers.size,
                });
            }

            default:
                return new Response("Not found", { status: 404 });
        }
    }

    private async broadcast(event: BroadcastEvent) {
        await Promise.all(
            [...this.activeUsers].map(async (userId) => {
                const userDO = this.env.USER_PRESENCE_DO.get(
                    this.env.USER_PRESENCE_DO.idFromName(userId)
                );

                await userDO.fetch("https://do/event", {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(event),
                });
            })
        );
    }
}
