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

type TypingBroadcastEvent = {
    type: "CONVERSATION_TYPING";
    conversationId: string;
    status: "started" | "stopped";
    userId: string;
    activeTypingUsers: string[];
};

type DurableBindingsEnv = {
    USER_PRESENCE_DO: DurableObjectNamespace;
};

export class ChatRoomDO extends DurableObject<DurableBindingsEnv> {
    private activeUsers: Set<string> | null = null; // null = not loaded yet
    private typingUsers: Set<string> | null = null; // null = not loaded yet

    private async getActiveUsers(): Promise<Set<string>> {
        if (this.activeUsers !== null) {
            return this.activeUsers;
        }
        const stored = await this.ctx.storage.get<string[]>("activeUsers");
        this.activeUsers = new Set(stored ?? []);
        return this.activeUsers;
    }

    private async persistActiveUsers(): Promise<void> {
        await this.ctx.storage.put("activeUsers", [...(this.activeUsers ?? [])]);
    }

    private async getTypingUsers(): Promise<Set<string>> {
        if (this.typingUsers !== null) {
            return this.typingUsers;
        }
        const stored = await this.ctx.storage.get<string[]>("typingUsers");
        this.typingUsers = new Set(stored ?? []);
        return this.typingUsers;
    }

    private async persistTypingUsers(): Promise<void> {
        await this.ctx.storage.put("typingUsers", [...(this.typingUsers ?? [])]);
    }

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

                const users = await this.getActiveUsers();
                users.add(userId);
                await this.persistActiveUsers();
                await this.broadcastPresenceChange("joined", userId, conversationId);
                return Response.json({
                    ok: true,
                    activeUsers: users.size,
                    activeUserIds: [...users],
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

                const users = await this.getActiveUsers();
                users.delete(userId);
                await this.persistActiveUsers();
                await this.stopTypingForUser(userId, conversationId);
                await this.broadcastPresenceChange("left", userId, conversationId);
                return Response.json({
                    ok: true,
                    activeUsers: users.size,
                    activeUserIds: [...users],
                });
            }

            case "/typing-start": {
                const { userId, conversationId } = (await request.json()) as UserPayload;
                if (!userId || !conversationId) {
                    return Response.json(
                        { error: "userId and conversationId are required" },
                        { status: 400 }
                    );
                }

                const typingUsers = await this.getTypingUsers();
                typingUsers.add(userId);
                await this.persistTypingUsers();
                await this.broadcastTypingChange("started", userId, conversationId);
                return Response.json({
                    ok: true,
                    typingUserIds: [...typingUsers],
                });
            }

            case "/typing-stop": {
                const { userId, conversationId } = (await request.json()) as UserPayload;
                if (!userId || !conversationId) {
                    return Response.json(
                        { error: "userId and conversationId are required" },
                        { status: 400 }
                    );
                }

                await this.stopTypingForUser(userId, conversationId);
                const typingUsers = await this.getTypingUsers();
                return Response.json({
                    ok: true,
                    typingUserIds: [...typingUsers],
                });
            }

            default:
                return new Response("Not found", { status: 404 });
        }
    }

    private async broadcast(event: BroadcastEvent) {
        const users = await this.getActiveUsers();
        await Promise.all(
            [...users].map(async (userId) => {
                const userDO = this.env.USER_PRESENCE_DO.get(
                    this.env.USER_PRESENCE_DO.idFromName(userId)
                );
                await userDO.fetch("https://do/event", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
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
        const users = await this.getActiveUsers();
        await this.broadcast({
            type: "CONVERSATION_PRESENCE",
            conversationId,
            status,
            userId,
            activeUsers: [...users],
            activeUsersCount: users.size,
        } satisfies PresenceBroadcastEvent);
    }

    private async stopTypingForUser(userId: string, conversationId: string) {
        const typingUsers = await this.getTypingUsers();
        if (!typingUsers.has(userId)) {
            return;
        }

        typingUsers.delete(userId);
        await this.persistTypingUsers();
        await this.broadcastTypingChange("stopped", userId, conversationId);
    }

    private async broadcastTypingChange(
        status: TypingBroadcastEvent["status"],
        userId: string,
        conversationId: string
    ) {
        const typingUsers = await this.getTypingUsers();
        await this.broadcast({
            type: "CONVERSATION_TYPING",
            conversationId,
            status,
            userId,
            activeTypingUsers: [...typingUsers],
        } satisfies TypingBroadcastEvent);
    }
}
