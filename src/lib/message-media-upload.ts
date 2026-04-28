"use client";

import { importPrivateKey, importPublicKey } from "./crypto-keys";
import { base64ToBuffer, bufferToBase64 } from "./crypto-pin";
import { decryptFileWithAes, encryptFileWithAes } from "./profile-image-encryption";
import { parseManagedMessageMediaUrl } from "./message-media-url";

const SESSION_KEYS_STORAGE_KEY = "yhla_session_keys";

type StoredSessionKeys = {
    publicKey: string;
    privateKey: string;
};

export type MessageMediaRecipientPublicKeyInput = {
    recipientUserId: string;
    publicKey: string | CryptoKey;
};

export interface MessageMediaUploadResult {
    mediaUrl: string;
    objectKey: string;
}

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
    const aesKeyBytes = base64ToBuffer(aesKeyBase64);
    const encrypted = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        aesKeyBytes.buffer.slice(
            aesKeyBytes.byteOffset,
            aesKeyBytes.byteOffset + aesKeyBytes.byteLength
        ) as ArrayBuffer
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

export async function uploadEncryptedMessageMedia(
    file: File,
    recipientPublicKeys: MessageMediaRecipientPublicKeyInput[]
): Promise<MessageMediaUploadResult> {
    if (recipientPublicKeys.length === 0) {
        throw new Error("At least one recipient public key is required.");
    }

    const normalizedRecipientKeys = await Promise.all(
        recipientPublicKeys.map(async (recipient) => ({
            recipientUserId: recipient.recipientUserId,
            publicKey:
                typeof recipient.publicKey === "string"
                    ? await importPublicKey(recipient.publicKey)
                    : recipient.publicKey,
        }))
    );

    const { encryptedData, aesKey, iv } = await encryptFileWithAes(file);
    const recipientKeys = await Promise.all(
        normalizedRecipientKeys.map(async (recipient) => ({
            recipientUserId: recipient.recipientUserId,
            encryptedAesKey: await encryptAesKeyWithPublicKey(
                aesKey,
                recipient.publicKey
            ),
        }))
    );

    const encryptedFile = new File([cloneUint8Array(encryptedData)], file.name, {
        type: file.type,
    });
    const formData = new FormData();
    formData.append("file", encryptedFile);
    formData.append("iv", iv);
    formData.append("recipientKeys", JSON.stringify(recipientKeys));

    const response = await fetch("/api/message-media", {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || "Failed to upload message media");
    }

    return response.json();
}

export async function fetchAndDecryptMessageMedia(
    objectKeyOrUrl: string
): Promise<Blob> {
    const sessionKeys = await retrieveSessionKeys();
    if (!sessionKeys?.privateKey) {
        throw new Error("No private key found in session. Please unlock your keys again.");
    }

    const parsed =
        parseManagedMessageMediaUrl(objectKeyOrUrl) ??
        ({ objectKey: objectKeyOrUrl } as const);

    const keyResponse = await fetch(`/api/message-media/key/${parsed.objectKey}`);
    if (!keyResponse.ok) {
        throw new Error("Failed to fetch message media encryption key");
    }

    const keyData = (await keyResponse.json()) as {
        aesKey: string;
        iv: string;
        mimeType: string;
    };
    const aesKeyBase64 = await decryptAesKeyWithPrivateKey(
        keyData.aesKey,
        sessionKeys.privateKey
    );

    const mediaResponse = await fetch(`/api/message-media/${parsed.objectKey}`);
    if (!mediaResponse.ok) {
        throw new Error("Failed to fetch encrypted message media");
    }

    const encryptedData = await mediaResponse.arrayBuffer();
    const decryptedData = await decryptFileWithAes(
        encryptedData,
        aesKeyBase64,
        keyData.iv
    );

    return new Blob([cloneUint8Array(decryptedData)], {
        type: keyData.mimeType,
    });
}
