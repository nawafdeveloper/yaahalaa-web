"use client";

import { importPrivateKey, importPublicKey } from "./crypto-keys";
import { base64ToBuffer, bufferToBase64 } from "./crypto-pin";
import { decryptFileWithAes, encryptFileWithAes } from "./profile-image-encryption";

const SESSION_KEYS_STORAGE_KEY = "yhla_session_keys";

export interface ProfileImageUploadResult {
    imageUrl: string;
    mediaId: string;
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

async function encryptAesKeyWithPublicKey(
    aesKeyBase64: string,
    publicKey: CryptoKey
): Promise<string> {
    const aesKeyBytes = Uint8Array.from(atob(aesKeyBase64), (char) => char.charCodeAt(0));
    const encrypted = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        aesKeyBytes
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
        encryptedBytes.buffer.slice(
            encryptedBytes.byteOffset,
            encryptedBytes.byteOffset + encryptedBytes.byteLength
        ) as ArrayBuffer
    );

    return bufferToBase64(decrypted);
}

function cloneUint8Array(data: Uint8Array): ArrayBuffer {
    const sourceBuffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
    );
    const arrayBuffer = new ArrayBuffer(sourceBuffer.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(sourceBuffer));
    return arrayBuffer;
}

/**
 * Encrypt and upload a profile image.
 * The image is encrypted with a random AES-256-GCM key before uploading.
 * The AES key is sent to the server for authorized access.
 */
export async function uploadEncryptedProfileImage(
    file: File
): Promise<ProfileImageUploadResult> {
    const sessionKeys = await retrieveSessionKeys();
    if (!sessionKeys?.publicKey) {
        throw new Error("No public key found in session. Please unlock your keys again.");
    }

    const { encryptedData, aesKey, iv } = await encryptFileWithAes(file);
    const encryptedAesKey = await encryptAesKeyWithPublicKey(aesKey, sessionKeys.publicKey);

    const encryptedFile = new File([cloneUint8Array(encryptedData)], file.name, {
        type: file.type,
    });

    const formData = new FormData();
    formData.append("file", encryptedFile);
    formData.append("aesKey", encryptedAesKey);
    formData.append("iv", iv);

    const response = await fetch("/api/profile-image", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw new Error(error.error || "Failed to upload profile image");
    }

    return response.json();
}

/**
 * Fetch and decrypt a profile image.
 * The client fetches the encrypted image and AES key separately.
 * Note: objectKey already includes the full path (e.g., p/d11921a8f40f4ec2/1776464818936.enc)
 */
export async function fetchAndDecryptProfileImage(objectKey: string): Promise<Blob> {
    const sessionKeys = await retrieveSessionKeys();
    if (!sessionKeys?.privateKey) {
        throw new Error("No private key found in session. Please unlock your keys again.");
    }

    const keyResponse = await fetch(`/api/profile-image/key/${objectKey}`);
    if (!keyResponse.ok) {
        throw new Error("Failed to fetch encryption key");
    }

    const keyData = await keyResponse.json() as { aesKey: string; iv: string; mimeType: string };
    const { aesKey: encryptedAesKeyBase64, iv: ivBase64, mimeType } = keyData;
    const aesKeyBase64 = await decryptAesKeyWithPrivateKey(
        encryptedAesKeyBase64,
        sessionKeys.privateKey
    );

    const imageResponse = await fetch(`/api/profile-image/${objectKey}`);
    if (!imageResponse.ok) {
        throw new Error("Failed to fetch encrypted image");
    }

    const encryptedData = await imageResponse.arrayBuffer();
    const decryptedData = await decryptFileWithAes(encryptedData, aesKeyBase64, ivBase64);
    return new Blob([cloneUint8Array(decryptedData)], { type: mimeType });
}
