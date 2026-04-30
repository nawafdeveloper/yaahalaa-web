import db from "@/db";
import { contacts, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
    buildPhoneLookupVariants,
    normalizePhoneNumber,
} from "@/lib/contact-utils";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { EncryptedTextPayload } from "@/lib/text-encryption";

interface UserSessionShape {
    id: string;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
    "Cache-Control": "no-store",
};

function hashPhoneNumber(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

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
    const rows = await db
        .select({
            contact_id: contacts.contact_id,
            owner_user_id: contacts.owner_user_id,
            linked_user_id: contacts.linked_user_id,
            linked_user_image: user.image,
            linked_user_public_key: user.yhlaPublicKey,
            linked_user_phone_number: user.phoneNumber,
            contact_ciphertext: contacts.contact_ciphertext,
            contact_encrypted_aes_key: contacts.contact_encrypted_aes_key,
            contact_iv: contacts.contact_iv,
            contact_algorithm: contacts.contact_algorithm,
            normalized_phone_hash: contacts.normalized_phone_hash,
            created_at: contacts.created_at,
            updated_at: contacts.updated_at,
        })
        .from(contacts)
        .leftJoin(user, eq(contacts.linked_user_id, user.id))
        .where(eq(contacts.owner_user_id, sessionUser.id))
        .orderBy(desc(contacts.updated_at));

    return Response.json({ contacts: rows }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
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
    const body = (await request.json()) as {
        linkedUserId?: string;
        phoneHash?: string;
        encryptedContact?: EncryptedTextPayload | null;
    };

    if (
        !body.linkedUserId ||
        !body.phoneHash ||
        !body.encryptedContact?.ciphertext ||
        !body.encryptedContact.encryptedAesKey ||
        !body.encryptedContact.iv
    ) {
        return Response.json(
            { error: "Missing required contact fields." },
            { status: 400, headers: noStoreHeaders }
        );
    }

    const [linkedAccount] = await db
        .select({
            id: user.id,
            phoneNumber: user.phoneNumber,
            email: user.email,
        })
        .from(user)
        .where(eq(user.id, body.linkedUserId));

    const linkedEmailPhone =
        linkedAccount?.email.toLowerCase().endsWith("@yaahalaa.com")
            ? linkedAccount.email.split("@")[0]
            : "";
    const linkedPhoneLookupSource =
        linkedAccount?.phoneNumber || linkedEmailPhone || "";

    if (!linkedAccount || !linkedPhoneLookupSource) {
        return Response.json(
            { error: "The selected account could not be found." },
            { status: 404, headers: noStoreHeaders }
        );
    }

    const normalizedLinkedPhone = normalizePhoneNumber(linkedPhoneLookupSource);
    const linkedPhoneVariants = buildPhoneLookupVariants(linkedPhoneLookupSource);
    const linkedPhoneHashes = new Set(
        linkedPhoneVariants.map((variant) => hashPhoneNumber(variant))
    );

    if (
        !normalizedLinkedPhone ||
        !linkedPhoneHashes.has(body.phoneHash)
    ) {
        return Response.json(
            { error: "The encrypted contact payload does not match the account." },
            { status: 400, headers: noStoreHeaders }
        );
    }

    const now = new Date();
    const contactId = crypto.randomUUID();

    await db
        .insert(contacts)
        .values({
            contact_id: contactId,
            owner_user_id: sessionUser.id,
            linked_user_id: linkedAccount.id,
            contact_ciphertext: body.encryptedContact.ciphertext,
            contact_encrypted_aes_key: body.encryptedContact.encryptedAesKey,
            contact_iv: body.encryptedContact.iv,
            contact_algorithm: body.encryptedContact.algorithm,
            normalized_phone_hash: body.phoneHash,
            created_at: now,
            updated_at: now,
        })
        .onConflictDoUpdate({
            target: [contacts.owner_user_id, contacts.linked_user_id],
            set: {
                contact_ciphertext: body.encryptedContact.ciphertext,
                contact_encrypted_aes_key: body.encryptedContact.encryptedAesKey,
                contact_iv: body.encryptedContact.iv,
                contact_algorithm: body.encryptedContact.algorithm,
                normalized_phone_hash: body.phoneHash,
                updated_at: now,
            },
        });

    const [savedContact] = await db
        .select({
            contact_id: contacts.contact_id,
            owner_user_id: contacts.owner_user_id,
            linked_user_id: contacts.linked_user_id,
            linked_user_image: user.image,
            linked_user_public_key: user.yhlaPublicKey,
            linked_user_phone_number: user.phoneNumber,
            contact_ciphertext: contacts.contact_ciphertext,
            contact_encrypted_aes_key: contacts.contact_encrypted_aes_key,
            contact_iv: contacts.contact_iv,
            contact_algorithm: contacts.contact_algorithm,
            normalized_phone_hash: contacts.normalized_phone_hash,
            created_at: contacts.created_at,
            updated_at: contacts.updated_at,
        })
        .from(contacts)
        .leftJoin(user, eq(contacts.linked_user_id, user.id))
        .where(
            and(
                eq(contacts.owner_user_id, sessionUser.id),
                eq(contacts.linked_user_id, linkedAccount.id)
            )
        );

    return Response.json(
        { contact: savedContact },
        { status: 201, headers: noStoreHeaders }
    );
}
