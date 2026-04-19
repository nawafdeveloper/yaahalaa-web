import { auth } from "@/lib/auth";
import db from "@/db";
import { message } from "@/db/schema";
import { or, eq } from "drizzle-orm";

/**
 * The better-auth `phoneNumber` plugin adds `phoneNumber` at runtime
 * but the server-side types do not expose it automatically.
 */
interface UserWithPhone {
    phoneNumber?: string | null;
}

// ---------------------------------------------------------------------------
// POST  /api/messages
// Store a new message.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        senderPhone?: string;
        recipientPhone?: string;
        content?: string;
    };

    const { senderPhone, recipientPhone, content } = body;

    if (!senderPhone || !recipientPhone || !content) {
        return Response.json(
            { error: "Missing required fields" },
            { status: 400 },
        );
    }

    // Only the authenticated user may send messages as themselves
    const sessionPhone = (session.user as unknown as UserWithPhone).phoneNumber;
    if (sessionPhone !== senderPhone) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = crypto.randomUUID();

    await db.insert(message).values({
        id,
        senderPhone,
        recipientPhone,
        content,
    });

    return Response.json({ success: true, id });
}

// ---------------------------------------------------------------------------
// GET  /api/messages?phone=...
// Retrieve all messages involving the given phone number.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const phone = url.searchParams.get("phone");

    if (!phone) {
        return Response.json(
            { error: "Missing phone parameter" },
            { status: 400 },
        );
    }

    // Only allow fetching your own messages
    const sessionPhone = (session.user as unknown as UserWithPhone).phoneNumber;
    if (sessionPhone !== phone) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
        .select()
        .from(message)
        .where(
            or(
                eq(message.senderPhone, phone),
                eq(message.recipientPhone, phone),
            ),
        );

    return Response.json({
        messages: rows.map((m) => ({
            id: m.id,
            sender_phone: m.senderPhone,
            content: m.content,
            timestamp: m.createdAt.getTime(),
        })),
    });
}
