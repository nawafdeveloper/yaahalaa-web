import db from "@/db";
import { contacts, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { normalizePhoneNumber } from "@/lib/contact-utils";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { EncryptedTextPayload } from "@/lib/text-encryption";

interface UserSessionShape {
    id: string;
}

function hashPhoneNumber(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as UserSessionShape;
    const rows = await db
        .select({
            contact_id: contacts.contact_id,
            owner_user_id: contacts.owner_user_id,
            linked_user_id: contacts.linked_user_id,
            linked_user_image: user.image,
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

    return Response.json({ contacts: rows });
}

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
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
            { status: 400 }
        );
    }

    const [linkedAccount] = await db
        .select({
            id: user.id,
            phoneNumber: user.phoneNumber,
        })
        .from(user)
        .where(eq(user.id, body.linkedUserId));

    if (!linkedAccount?.phoneNumber) {
        return Response.json(
            { error: "The selected account could not be found." },
            { status: 404 }
        );
    }

    const normalizedLinkedPhone = normalizePhoneNumber(linkedAccount.phoneNumber);

    if (
        !normalizedLinkedPhone ||
        hashPhoneNumber(normalizedLinkedPhone) !== body.phoneHash
    ) {
        return Response.json(
            { error: "The encrypted contact payload does not match the account." },
            { status: 400 }
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

    return Response.json({ contact: savedContact }, { status: 201 });
}
