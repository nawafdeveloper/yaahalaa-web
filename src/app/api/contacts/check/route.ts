import db from "@/db";
import { contacts, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
    buildPhoneDigitLookupVariants,
    buildPhoneLookupVariants,
    normalizePhoneNumber,
} from "@/lib/contact-utils";
import { and, eq, inArray, or, sql } from "drizzle-orm";

interface UserSessionShape {
    id: string;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
    "Cache-Control": "no-store",
};

const missingAccountResponse = {
    exists: false,
    linkedUserId: null,
    alreadyExists: false,
};

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json(
            { error: "Unauthorized" },
            { status: 401, headers: noStoreHeaders }
        );
    }

    const sessionUser = session.user as UserSessionShape;
    const url = new URL(request.url);
    const rawPhone = url.searchParams.get("phone") ?? "";
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    const phoneLookupVariants = buildPhoneLookupVariants(rawPhone);
    const phoneDigitLookupVariants = buildPhoneDigitLookupVariants(rawPhone);

    if (
        !normalizedPhone ||
        phoneLookupVariants.length === 0 ||
        phoneDigitLookupVariants.length === 0
    ) {
        return Response.json(missingAccountResponse, {
            status: 200,
            headers: noStoreHeaders,
        });
    }

    const [accountMatch] = await db
        .select({
            id: user.id,
            phoneNumber: user.phoneNumber,
        })
        .from(user)
        .where(
            or(
                inArray(user.phoneNumber, phoneLookupVariants),
                inArray(
                    sql<string>`regexp_replace(coalesce(${user.phoneNumber}, ''), '[^0-9]', '', 'g')`,
                    phoneDigitLookupVariants
                ),
                inArray(
                    sql<string>`case when lower(split_part(coalesce(${user.email}, ''), '@', 2)) = 'yaahalaa.com' then regexp_replace(split_part(coalesce(${user.email}, ''), '@', 1), '[^0-9]', '', 'g') else '' end`,
                    phoneDigitLookupVariants
                )
            )
        )
        .limit(1);

    if (!accountMatch) {
        return Response.json(missingAccountResponse, {
            headers: noStoreHeaders,
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
    }, {
        headers: noStoreHeaders,
    });
}
