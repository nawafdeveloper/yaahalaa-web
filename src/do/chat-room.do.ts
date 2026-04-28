import { DurableObject } from "cloudflare:workers";

type BroadcastEvent = {
    type: string;
    [key: string]: unknown;
};

type UserPayload = {
    userId?: string;
    conversationId?: string;
};

type PresenceBroadcastEvent = {
    type: "CONVERSATION_PRESENCE";
    conversationId: string;
    status: "joined" | "left";
    userId: string;
    activeUsers: string[];
    activeUsersCount: number;
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
                const { userId, conversationId } = (await request.json()) as UserPayload;
                if (!userId || !conversationId) {
                    return Response.json(
                        { error: "userId and conversationId are required" },
                        { status: 400 }
                    );
                }

                this.activeUsers.add(userId);
                await this.broadcastPresenceChange("joined", userId, conversationId);
                return Response.json({
                    ok: true,
                    activeUsers: this.activeUsers.size,
                    activeUserIds: [...this.activeUsers],
                });
            }

            case "/user-left": {
                const { userId, conversationId } = (await request.json()) as UserPayload;
                if (!userId || !conversationId) {
                    return Response.json(
                        { error: "userId and conversationId are required" },
                        { status: 400 }
                    );
                }

                this.activeUsers.delete(userId);
                await this.broadcastPresenceChange("left", userId, conversationId);
                return Response.json({
                    ok: true,
                    activeUsers: this.activeUsers.size,
                    activeUserIds: [...this.activeUsers],
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

    private async broadcastPresenceChange(
        status: PresenceBroadcastEvent["status"],
        userId: string,
        conversationId: string
    ) {
        await this.broadcast({
            type: "CONVERSATION_PRESENCE",
            conversationId,
            status,
            userId,
            activeUsers: [...this.activeUsers],
            activeUsersCount: this.activeUsers.size,
        } satisfies PresenceBroadcastEvent);
    }
}
