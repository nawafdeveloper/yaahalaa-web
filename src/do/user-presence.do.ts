import db from "@/db";
import { message as messageTable } from "@/db/schema";
import { DurableObject } from "cloudflare:workers";

type SessionState = {
    userId: string;
    activeConversationId: string | null;
};

type PresenceIncomingMessage =
    | {
          type: "JOIN_CONVERSATION";
          conversationId: string;
      }
    | {
          type: "LEAVE_CONVERSATION";
          conversationId?: string;
      }
    | {
          type: "SEND_MESSAGE";
          conversationId?: string;
          conversationType: "direct" | "group";
          senderPhone: string;
          recipientPhone?: string;
          participantIds?: string[];
          content: string;
      }
    | {
          type: "MARK_READ";
          conversationId: string;
          messageId?: string;
      }
    | {
          type: "MARK_DELIVERED";
          conversationId: string;
          messageId?: string;
      };

type ChatEvent = {
    type: string;
    [key: string]: unknown;
};

type StoredMessage = {
    id: string;
    senderPhone: string;
    recipientPhone: string;
    content: string;
    createdAt: string;
};

type DurableBindingsEnv = {
    CHAT_ROOM_DO: DurableObjectNamespace;
    USER_PRESENCE_DO: DurableObjectNamespace;
};

export class UserPresenceDO extends DurableObject<DurableBindingsEnv> {
    private sessions = new Map<WebSocket, SessionState>();

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/event" && request.method === "POST") {
            const event = (await request.json()) as ChatEvent;
            await this.receiveEvent(event);
            return Response.json({ ok: true });
        }

        const upgradeHeader = request.headers.get("Upgrade");
        if (upgradeHeader !== "websocket") {
            return new Response("Expected WebSocket", { status: 426 });
        }

        const userId = url.searchParams.get("userId");
        if (!userId) {
            return Response.json(
                { error: "Missing userId query parameter" },
                { status: 400 }
            );
        }

        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        this.sessions.set(server, {
            userId,
            activeConversationId: null,
        });
        this.ctx.acceptWebSocket(server);

        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws: WebSocket, rawMessage: string) {
        const session = this.sessions.get(ws);
        if (!session) {
            ws.close(1011, "Unknown websocket session");
            return;
        }

        let data: PresenceIncomingMessage;
        try {
            data = JSON.parse(rawMessage) as PresenceIncomingMessage;
        } catch {
            ws.send(
                JSON.stringify({
                    type: "ERROR",
                    message: "Invalid JSON payload",
                })
            );
            return;
        }

        try {
            switch (data.type) {
                case "JOIN_CONVERSATION": {
                    await this.leaveConversationIfNeeded(session);
                    session.activeConversationId = data.conversationId;
                    await this.notifyRoom(
                        "/user-joined",
                        data.conversationId,
                        session.userId
                    );
                    break;
                }

                case "LEAVE_CONVERSATION": {
                    await this.leaveConversationIfNeeded(
                        session,
                        data.conversationId
                    );
                    break;
                }

                case "SEND_MESSAGE": {
                    await this.handleSendMessage(data);
                    break;
                }

                case "MARK_DELIVERED":
                case "MARK_READ": {
                    await this.receiveEvent({
                        type: data.type,
                        conversationId: data.conversationId,
                        messageId: data.messageId ?? null,
                        userId: session.userId,
                    });
                    break;
                }

                default: {
                    ws.send(
                        JSON.stringify({
                            type: "ERROR",
                            message: "Unsupported message type",
                        })
                    );
                }
            }
        } catch (error) {
            ws.send(
                JSON.stringify({
                    type: "ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Unexpected realtime error",
                })
            );
        }
    }

    async webSocketClose(ws: WebSocket) {
        const session = this.sessions.get(ws);
        if (session) {
            await this.leaveConversationIfNeeded(session);
            this.sessions.delete(ws);
        }
    }

    async webSocketError(ws: WebSocket) {
        const session = this.sessions.get(ws);
        if (session) {
            await this.leaveConversationIfNeeded(session);
            this.sessions.delete(ws);
        }
    }

    private async receiveEvent(event: ChatEvent) {
        const payload = JSON.stringify(event);

        for (const ws of this.ctx.getWebSockets()) {
            ws.send(payload);
        }
    }

    private async handleSendMessage(
        data: Extract<PresenceIncomingMessage, { type: "SEND_MESSAGE" }>
    ) {
        if (!data.senderPhone || !data.content) {
            return;
        }

        if (data.conversationType === "group") {
            throw new Error(
                "Group message persistence is blocked until the business schema is defined."
            );
        }

        if (!data.recipientPhone) {
            throw new Error("recipientPhone is required for direct messages.");
        }

        const savedMessage = await saveDirectMessageToDb(
            data.senderPhone,
            data.recipientPhone,
            data.content
        );
        const conversationId =
            data.conversationId ??
            buildDirectRoomId(data.senderPhone, data.recipientPhone);

        const roomDO = this.env.CHAT_ROOM_DO.get(
            this.env.CHAT_ROOM_DO.idFromName(conversationId)
        );

        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                type: "NEW_MESSAGE",
                conversationId,
                conversationType: "direct",
                message: savedMessage,
            }),
        });

        await this.notifyParticipant(data.recipientPhone, {
            type: "CONVERSATION_UPDATED",
            conversationId,
            conversationType: "direct",
            lastMessage: savedMessage,
            unreadCount: 1,
        });
    }

    private async notifyParticipant(userId: string, event: ChatEvent) {
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
    }

    private async leaveConversationIfNeeded(
        session: SessionState,
        requestedConversationId?: string
    ) {
        const conversationId =
            requestedConversationId ?? session.activeConversationId;
        if (!conversationId) {
            return;
        }

        await this.notifyRoom("/user-left", conversationId, session.userId);
        if (session.activeConversationId === conversationId) {
            session.activeConversationId = null;
        }
    }

    private async notifyRoom(
        pathname: "/user-joined" | "/user-left",
        roomId: string,
        userId: string
    ) {
        const roomDO = this.env.CHAT_ROOM_DO.get(
            this.env.CHAT_ROOM_DO.idFromName(roomId)
        );

        await roomDO.fetch(`https://do${pathname}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ userId }),
        });
    }
}

function buildDirectRoomId(senderPhone: string, recipientPhone: string) {
    return [senderPhone, recipientPhone].sort().join("::");
}

async function saveDirectMessageToDb(
    senderPhone: string,
    recipientPhone: string,
    content: string
): Promise<StoredMessage> {
    const id = crypto.randomUUID();
    const createdAt = new Date();

    await db.insert(messageTable).values({
        id,
        senderPhone,
        recipientPhone,
        content,
        createdAt,
    });

    return {
        id,
        senderPhone,
        recipientPhone,
        content,
        createdAt: createdAt.toISOString(),
    };
}
