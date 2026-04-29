import db from "@/db";
import { contacts, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
    buildPhoneLookupVariants,
    normalizePhoneNumber,
} from "@/lib/contact-utils";
import { and, eq, inArray } from "drizzle-orm";

interface UserSessionShape {
    id: string;
}

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as UserSessionShape;
    const url = new URL(request.url);
    const rawPhone = url.searchParams.get("phone") ?? "";
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    const phoneLookupVariants = buildPhoneLookupVariants(rawPhone);

    if (!normalizedPhone || phoneLookupVariants.length === 0) {
        return Response.json(
            { exists: false, linkedUserId: null, alreadyExists: false },
            { status: 200 }
        );
    }

    const [accountMatch] = await db
        .select({
            id: user.id,
            phoneNumber: user.phoneNumber,
        })
        .from(user)
        .where(inArray(user.phoneNumber, phoneLookupVariants));

    if (!accountMatch) {
        return Response.json({
            exists: false,
            linkedUserId: null,
            alreadyExists: false,
        });
    }

    const [existingContact] = await db
        .select({
            contact_id: contacts.contact_id,
        })
        .from(contacts)
        .where(
            and(
                eq(contacts.owner_user_id, sessionUser.id),
                eq(contacts.linked_user_id, accountMatch.id)
            )
        );

    return Response.json({
        exists: true,
        linkedUserId: accountMatch.id,
        alreadyExists: Boolean(existingContact),
    });
}
