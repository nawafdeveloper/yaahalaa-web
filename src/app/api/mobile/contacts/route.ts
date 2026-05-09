import db from "@/db";
import { contacts, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { importPublicKey } from "@/lib/crypto-keys";
import { bufferToBase64 } from "@/lib/crypto-pin";
import {
    buildPhoneDigitLookupVariants,
    buildPhoneLookupVariants,
    normalizePhoneNumber,
} from "@/lib/contact-utils";
import type { ContactPayload, StoredContactRecord } from "@/types/contacts.type";
import type { TextEncryptionAlgorithm } from "@/types/crypto";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

type SessionUser = {
    id: string;
};

type JsonRecord = Record<string, unknown>;

type MobileContactPayload = ContactPayload & {
    expo_contact?: JsonRecord;
    matched_phone_number?: string;
};

type PhoneCandidate = {
    normalizedPhone: string;
    payload: MobileContactPayload;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
    "Cache-Control": "no-store",
};

const TEXT_ENCRYPTION_ALGORITHM =
    "aes-256-gcm+rsa-oaep-sha256" satisfies TextEncryptionAlgorithm;
const MAX_PHONE_NUMBERS_PER_SYNC = 2000;

function hashPhoneNumber(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(record: JsonRecord, keys: string[]): string {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
}

function getImageUri(record: JsonRecord): string {
    const directValue = getStringField(record, [
        "contact_avatar",
        "imageUri",
        "imageURL",
        "thumbnailUri",
    ]);

    if (directValue) {
        return directValue;
    }

    const image = record.image;
    if (isRecord(image)) {
        return getStringField(image, ["uri", "url"]);
    }

    return "";
}

function getPhoneValue(value: unknown): string {
    if (typeof value === "string") {
        return value.trim();
    }

    if (!isRecord(value)) {
        return "";
    }

    return getStringField(value, [
        "number",
        "digits",
        "phoneNumber",
        "contact_number",
        "normalizedNumber",
        "value",
    ]);
}

function extractPhoneValues(input: unknown): string[] {
    if (typeof input === "string") {
        return [input];
    }

    if (!isRecord(input)) {
        return [];
    }

    const values = [
        getStringField(input, [
            "contact_number",
            "contactNumber",
            "phoneNumber",
            "normalizedPhoneNumber",
            "number",
        ]),
    ];

    for (const key of ["phoneNumbers", "phones", "numbers"]) {
        const phoneNumbers = input[key];
        if (!Array.isArray(phoneNumbers)) {
            continue;
        }

        for (const phoneNumber of phoneNumbers) {
            values.push(getPhoneValue(phoneNumber));
        }
    }

    return values.map((value) => value.trim()).filter(Boolean);
}

function splitDisplayName(displayName: string) {
    const [firstName = "", ...rest] = displayName.trim().split(/\s+/);

    return {
        firstName,
        secondName: rest.join(" "),
    };
}

function buildContactPayload(input: unknown, normalizedPhone: string): MobileContactPayload {
    if (typeof input === "string" || !isRecord(input)) {
        return {
            contact_number: normalizedPhone,
            matched_phone_number: normalizedPhone,
        };
    }

    const displayName = getStringField(input, [
        "name",
        "displayName",
        "fullName",
    ]);
    const splitName = splitDisplayName(displayName);
    const firstName =
        getStringField(input, [
            "contact_first_name",
            "firstName",
            "givenName",
        ]) || splitName.firstName;
    const secondName =
        getStringField(input, [
            "contact_second_name",
            "lastName",
            "familyName",
            "middleName",
        ]) || splitName.secondName;
    const avatar = getImageUri(input);
    const bio = getStringField(input, [
        "contact_bio",
        "note",
        "notes",
        "company",
        "jobTitle",
        "nickname",
    ]);

    return {
        contact_first_name: firstName || undefined,
        contact_second_name: secondName || undefined,
        contact_number: normalizedPhone,
        contact_avatar: avatar || undefined,
        contact_bio: bio || undefined,
        expo_contact: input,
        matched_phone_number: normalizedPhone,
    };
}

function readContactInputs(body: unknown): unknown[] | null {
    if (Array.isArray(body)) {
        return body;
    }

    if (!isRecord(body)) {
        return null;
    }

    const inputs: unknown[] = [];
    let hasInputArray = false;

    if (Array.isArray(body.contacts)) {
        hasInputArray = true;
        inputs.push(...body.contacts);
    }

    for (const key of ["phoneNumbers", "numbers"]) {
        const phoneNumbers = body[key];
        if (Array.isArray(phoneNumbers)) {
            hasInputArray = true;
            inputs.push(...phoneNumbers);
        }
    }

    return hasInputArray ? inputs : null;
}

function buildPhoneCandidates(inputs: unknown[]): PhoneCandidate[] {
    const candidatesByPhone = new Map<string, PhoneCandidate>();

    for (const input of inputs) {
        for (const phoneValue of extractPhoneValues(input)) {
            const normalizedPhone = normalizePhoneNumber(phoneValue);

            if (!normalizedPhone || candidatesByPhone.has(normalizedPhone)) {
                continue;
            }

            candidatesByPhone.set(normalizedPhone, {
                normalizedPhone,
                payload: buildContactPayload(input, normalizedPhone),
            });
        }
    }

    return [...candidatesByPhone.values()];
}

function buildCandidateLookup(candidates: PhoneCandidate[]) {
    const lookup = new Map<string, PhoneCandidate>();

    for (const candidate of candidates) {
        for (const variant of buildPhoneLookupVariants(candidate.normalizedPhone)) {
            if (!lookup.has(variant)) {
                lookup.set(variant, candidate);
            }
        }
    }

    return lookup;
}

function getYaahalaaEmailPhone(email: string | null): string {
    if (!email?.toLowerCase().endsWith("@yaahalaa.com")) {
        return "";
    }

    return email.split("@")[0] ?? "";
}

function findCandidateForAccount(
    account: { phoneNumber: string | null; email: string | null },
    candidateLookup: Map<string, PhoneCandidate>
) {
    const sources = [
        account.phoneNumber ?? "",
        getYaahalaaEmailPhone(account.email),
    ].filter(Boolean);

    for (const source of sources) {
        for (const variant of buildPhoneLookupVariants(source)) {
            const candidate = candidateLookup.get(variant);
            if (candidate) {
                return candidate;
            }
        }
    }

    return null;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}

async function encryptContactPayloadForOwner(
    payload: MobileContactPayload,
    publicKey: CryptoKey
): Promise<{
    ciphertext: string;
    encryptedAesKey: string;
    iv: string;
    algorithm: TextEncryptionAlgorithm;
}> {
    const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(JSON.stringify(payload));
    const encryptedText = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        toArrayBuffer(plaintextBytes)
    );
    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKey = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawAesKey
    );

    return {
        ciphertext: bufferToBase64(encryptedText),
        encryptedAesKey: bufferToBase64(encryptedAesKey),
        iv: bufferToBase64(iv),
        algorithm: TEXT_ENCRYPTION_ALGORITHM,
    };
}

async function getStoredContacts(ownerUserId: string): Promise<StoredContactRecord[]> {
    return db
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
        .where(eq(contacts.owner_user_id, ownerUserId))
        .orderBy(desc(contacts.updated_at));
}

export async function POST(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: new Headers(request.headers),
        });

        if (!session) {
            return Response.json(
                { error: "Unauthorized" },
                { status: 401, headers: noStoreHeaders }
            );
        }

        const sessionUser = session.user as unknown as SessionUser;
        const body = (await request.json()) as unknown;
        const inputs = readContactInputs(body);

        if (!inputs) {
            return Response.json(
                {
                    error:
                        "Send contacts as an array or as { contacts: [...] } / { phoneNumbers: [...] }.",
                },
                { status: 400, headers: noStoreHeaders }
            );
        }

        const candidates = buildPhoneCandidates(inputs);

        if (candidates.length > MAX_PHONE_NUMBERS_PER_SYNC) {
            return Response.json(
                {
                    error: `Too many phone numbers. Send at most ${MAX_PHONE_NUMBERS_PER_SYNC} per sync.`,
                },
                { status: 400, headers: noStoreHeaders }
            );
        }

        const [owner] = await db
            .select({
                id: user.id,
                publicKey: user.yhlaPublicKey,
            })
            .from(user)
            .where(eq(user.id, sessionUser.id));

        if (!owner?.publicKey) {
            return Response.json(
                { error: "Current user has no encryption public key." },
                { status: 400, headers: noStoreHeaders }
            );
        }

        if (candidates.length === 0) {
            return Response.json(
                {
                    contacts: await getStoredContacts(sessionUser.id),
                    imported: {
                        receivedPhoneNumbers: 0,
                        matchedUsers: 0,
                        createdContacts: 0,
                        skippedExisting: 0,
                    },
                },
                { headers: noStoreHeaders }
            );
        }

        const ownerPublicKey = await importPublicKey(owner.publicKey);

        const phoneLookupVariants = [
            ...new Set(
                candidates.flatMap((candidate) =>
                    buildPhoneLookupVariants(candidate.normalizedPhone)
                )
            ),
        ];
        const phoneDigitLookupVariants = [
            ...new Set(
                candidates.flatMap((candidate) =>
                    buildPhoneDigitLookupVariants(candidate.normalizedPhone)
                )
            ),
        ];

        const matchedAccounts = await db
            .select({
                id: user.id,
                phoneNumber: user.phoneNumber,
                email: user.email,
            })
            .from(user)
            .where(
                and(
                    ne(user.id, sessionUser.id),
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
            );
        const matchedUserIds = matchedAccounts.map((account) => account.id);
        const existingContacts =
            matchedUserIds.length > 0
                ? await db
                      .select({
                          linkedUserId: contacts.linked_user_id,
                      })
                      .from(contacts)
                      .where(
                          and(
                              eq(contacts.owner_user_id, sessionUser.id),
                              inArray(contacts.linked_user_id, matchedUserIds)
                          )
                      )
                : [];
        const existingLinkedUserIds = new Set(
            existingContacts.map((contact) => contact.linkedUserId)
        );
        const candidateLookup = buildCandidateLookup(candidates);
        const now = new Date();
        const rowsToInsert: (typeof contacts.$inferInsert)[] = [];

        for (const account of matchedAccounts) {
            if (existingLinkedUserIds.has(account.id)) {
                continue;
            }

            const candidate = findCandidateForAccount(account, candidateLookup);
            if (!candidate) {
                continue;
            }

            const encryptedContact = await encryptContactPayloadForOwner(
                candidate.payload,
                ownerPublicKey
            );

            rowsToInsert.push({
                contact_id: crypto.randomUUID(),
                owner_user_id: sessionUser.id,
                linked_user_id: account.id,
                contact_ciphertext: encryptedContact.ciphertext,
                contact_encrypted_aes_key: encryptedContact.encryptedAesKey,
                contact_iv: encryptedContact.iv,
                contact_algorithm: encryptedContact.algorithm,
                normalized_phone_hash: hashPhoneNumber(candidate.normalizedPhone),
                created_at: now,
                updated_at: now,
            });
        }

        if (rowsToInsert.length > 0) {
            await db
                .insert(contacts)
                .values(rowsToInsert)
                .onConflictDoNothing({
                    target: [contacts.owner_user_id, contacts.linked_user_id],
                });
        }

        return Response.json(
            {
                contacts: await getStoredContacts(sessionUser.id),
                imported: {
                    receivedPhoneNumbers: candidates.length,
                    matchedUsers: matchedAccounts.length,
                    createdContacts: rowsToInsert.length,
                    skippedExisting: existingLinkedUserIds.size,
                },
            },
            { headers: noStoreHeaders }
        );
    } catch (error) {
        console.error("Failed to sync mobile contacts", error);

        return Response.json(
            { error: "Failed to sync mobile contacts." },
            { status: 500, headers: noStoreHeaders }
        );
    }
}
