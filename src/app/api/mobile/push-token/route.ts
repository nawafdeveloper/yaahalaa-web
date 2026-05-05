import { auth } from "@/lib/auth";
import db from "@/db";
import { user } from "@/db/schema";
import { isExpoPushToken } from "@/lib/expo-push-notifications";
import { eq } from "drizzle-orm";

interface SessionUser {
    id: string;
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        token?: string | null;
    };
    const token = body.token?.trim() ?? "";

    if (token && !isExpoPushToken(token)) {
        return Response.json(
            { error: "Invalid Expo push token." },
            { status: 400 }
        );
    }

    const sessionUser = session.user as unknown as SessionUser;

    await db
        .update(user)
        .set({ yhlaPushToken: token })
        .where(eq(user.id, sessionUser.id));

    return Response.json({
        success: true,
        yhlaPushToken: token,
    });
}

export async function DELETE(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as unknown as SessionUser;

    await db
        .update(user)
        .set({ yhlaPushToken: "" })
        .where(eq(user.id, sessionUser.id));

    return Response.json({
        success: true,
        yhlaPushToken: "",
    });
}
