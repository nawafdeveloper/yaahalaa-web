import { decode as b64Decode, encode as b64Encode } from "@stablelib/base64";

const PROFILE_IMAGE_ALGORITHM = "AES-GCM";
const PROFILE_IMAGE_KEY_LENGTH = 256;
const PROFILE_IMAGE_IV_BYTES = 12;

export const PROFILE_IMAGE_VERSION = "v1";
export const PROFILE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_ACCEPTED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
] as const;

function randomBytes(length: number): Uint8Array {
    return Uint8Array.from(crypto.getRandomValues(new Uint8Array(length)));
}

function normalizeBytes(bytes: Uint8Array): Uint8Array {
    return Uint8Array.from(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
}

function assertValidAesKeySize(keyBytes: Uint8Array) {
    if (keyBytes.byteLength !== PROFILE_IMAGE_KEY_LENGTH / 8) {
        throw new Error("Invalid AES key length for profile image encryption.");
    }
}

async function importAesKey(keyBytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
    assertValidAesKeySize(keyBytes);

    return crypto.subtle.importKey(
        "raw",
        toArrayBuffer(keyBytes),
        {
            name: PROFILE_IMAGE_ALGORITHM,
            length: PROFILE_IMAGE_KEY_LENGTH,
        },
        false,
        usages,
    );
}

export function isSupportedProfileImageType(mimeType: string): boolean {
    return PROFILE_IMAGE_ACCEPTED_MIME_TYPES.includes(
        mimeType as (typeof PROFILE_IMAGE_ACCEPTED_MIME_TYPES)[number],
    );
}

export async function encryptProfileImageFile(file: Blob): Promise<{
    encryptedFile: Blob;
    key: string;
    iv: string;
    version: string;
}> {
    const plaintext = await file.arrayBuffer();
    const key = await crypto.subtle.generateKey(
        {
            name: PROFILE_IMAGE_ALGORITHM,
            length: PROFILE_IMAGE_KEY_LENGTH,
        },
        true,
        ["encrypt", "decrypt"],
    );
    const iv = randomBytes(PROFILE_IMAGE_IV_BYTES);
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: PROFILE_IMAGE_ALGORITHM,
            iv: toArrayBuffer(iv),
        },
        key,
        plaintext,
    );
    const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));

    return {
        encryptedFile: new Blob([ciphertext], {
            type: "application/octet-stream",
        }),
        key: b64Encode(rawKey),
        iv: b64Encode(iv),
        version: PROFILE_IMAGE_VERSION,
    };
}

export async function decryptProfileImageBuffer(
    ciphertext: ArrayBuffer,
    keyB64: string,
    ivB64: string,
): Promise<ArrayBuffer> {
    const keyBytes = normalizeBytes(b64Decode(keyB64));
    const iv = normalizeBytes(b64Decode(ivB64));
    const key = await importAesKey(keyBytes, ["decrypt"]);

    return crypto.subtle.decrypt(
        {
            name: PROFILE_IMAGE_ALGORITHM,
            iv: toArrayBuffer(iv),
        },
        key,
        ciphertext,
    );
}

export async function wrapProfileImageKey(
    keyB64: string,
    masterKeyB64: string,
): Promise<{
    wrappedKey: string;
    wrappedKeyIv: string;
}> {
    const keyBytes = normalizeBytes(b64Decode(keyB64));
    const masterKeyBytes = normalizeBytes(b64Decode(masterKeyB64));
    const wrappingKey = await importAesKey(masterKeyBytes, ["encrypt"]);
    const wrappedKeyIv = randomBytes(PROFILE_IMAGE_IV_BYTES);
    const wrappedKey = await crypto.subtle.encrypt(
        {
            name: PROFILE_IMAGE_ALGORITHM,
            iv: toArrayBuffer(wrappedKeyIv),
        },
        wrappingKey,
        toArrayBuffer(keyBytes),
    );

    return {
        wrappedKey: b64Encode(new Uint8Array(wrappedKey)),
        wrappedKeyIv: b64Encode(wrappedKeyIv),
    };
}

export async function unwrapProfileImageKey(
    wrappedKeyB64: string,
    wrappedKeyIvB64: string,
    masterKeyB64: string,
): Promise<string> {
    const wrappedKey = normalizeBytes(b64Decode(wrappedKeyB64));
    const wrappedKeyIv = normalizeBytes(b64Decode(wrappedKeyIvB64));
    const masterKeyBytes = normalizeBytes(b64Decode(masterKeyB64));
    const wrappingKey = await importAesKey(masterKeyBytes, ["decrypt"]);
    const unwrappedKey = await crypto.subtle.decrypt(
        {
            name: PROFILE_IMAGE_ALGORITHM,
            iv: toArrayBuffer(wrappedKeyIv),
        },
        wrappingKey,
        toArrayBuffer(wrappedKey),
    );

    return b64Encode(new Uint8Array(unwrappedKey));
}
