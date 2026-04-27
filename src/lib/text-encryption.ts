"use client";

import { importPrivateKey, importPublicKey } from "./crypto-keys";
import { base64ToBuffer, bufferToBase64 } from "./crypto-pin";

const SESSION_KEYS_STORAGE_KEY = "yhla_session_keys";

export const TEXT_ENCRYPTION_ALGORITHM = "aes-256-gcm+rsa-oaep-sha256";

export interface EncryptedTextPayload {
    ciphertext: string;
    encryptedAesKey: string;
    iv: string;
    algorithm: typeof TEXT_ENCRYPTION_ALGORITHM;
}

type StoredSessionKeys = {
    publicKey: string;
    privateKey: string;
};

async function retrieveSessionKeys(): Promise<{
    publicKey: CryptoKey;
    privateKey: CryptoKey;
} | null> {
    const stored = localStorage.getItem(SESSION_KEYS_STORAGE_KEY);
    if (!stored) {
        return null;
    }

    try {
        const data = JSON.parse(stored) as StoredSessionKeys;
        const publicKey = await importPublicKey(data.publicKey);
        const privateKeyBytes = base64ToBuffer(data.privateKey);
        const privateKey = await importPrivateKey(
            privateKeyBytes.buffer.slice(
                privateKeyBytes.byteOffset,
                privateKeyBytes.byteOffset + privateKeyBytes.byteLength
            ) as ArrayBuffer,
            true
        );

        return { publicKey, privateKey };
    } catch {
        return null;
    }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}

async function encryptAesKeyWithPublicKey(
    aesKeyBase64: string,
    publicKey: CryptoKey
): Promise<string> {
    const aesKeyBytes = base64ToBuffer(aesKeyBase64);
    const encrypted = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        toArrayBuffer(aesKeyBytes)
    );

    return bufferToBase64(encrypted);
}

async function decryptAesKeyWithPrivateKey(
    encryptedAesKeyBase64: string,
    privateKey: CryptoKey
): Promise<string> {
    const encryptedBytes = base64ToBuffer(encryptedAesKeyBase64);
    const decrypted = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        toArrayBuffer(encryptedBytes)
    );

    return bufferToBase64(decrypted);
}

export async function encryptTextWithPublicKey(
    plaintext: string,
    publicKey: CryptoKey
): Promise<EncryptedTextPayload> {
    const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(plaintext);

    const encryptedText = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        toArrayBuffer(plaintextBytes)
    );

    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const aesKeyBase64 = bufferToBase64(rawAesKey);
    const encryptedAesKey = await encryptAesKeyWithPublicKey(aesKeyBase64, publicKey);

    return {
        ciphertext: bufferToBase64(encryptedText),
        encryptedAesKey,
        iv: bufferToBase64(iv),
        algorithm: TEXT_ENCRYPTION_ALGORITHM,
    };
}

export async function decryptTextWithPrivateKey(
    payload: Pick<EncryptedTextPayload, "ciphertext" | "encryptedAesKey" | "iv">,
    privateKey: CryptoKey
): Promise<string> {
    const aesKeyBase64 = await decryptAesKeyWithPrivateKey(
        payload.encryptedAesKey,
        privateKey
    );
    const aesKeyBytes = base64ToBuffer(aesKeyBase64);
    const ciphertextBytes = base64ToBuffer(payload.ciphertext);
    const ivBytes = base64ToBuffer(payload.iv);

    const aesKey = await crypto.subtle.importKey(
        "raw",
        toArrayBuffer(aesKeyBytes),
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: toArrayBuffer(ivBytes),
        },
        aesKey,
        toArrayBuffer(ciphertextBytes)
    );

    return new TextDecoder().decode(decrypted);
}

export async function encryptText(plaintext: string): Promise<EncryptedTextPayload> {
    const sessionKeys = await retrieveSessionKeys();
    if (!sessionKeys?.publicKey) {
        throw new Error("No public key found in session. Please unlock your keys again.");
    }

    return encryptTextWithPublicKey(plaintext, sessionKeys.publicKey);
}

export async function decryptText(
    payload: Pick<EncryptedTextPayload, "ciphertext" | "encryptedAesKey" | "iv">
): Promise<string> {
    const sessionKeys = await retrieveSessionKeys();
    if (!sessionKeys?.privateKey) {
        throw new Error("No private key found in session. Please unlock your keys again.");
    }

    return decryptTextWithPrivateKey(payload, sessionKeys.privateKey);
}
