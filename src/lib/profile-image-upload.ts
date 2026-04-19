"use client";

import { encryptFileWithAes, decryptFileWithAes } from "./profile-image-encryption";

export interface ProfileImageUploadResult {
    imageUrl: string;
    mediaId: string;
}

/**
 * Encrypt and upload a profile image.
 * The image is encrypted with a random AES-256-GCM key before uploading.
 * The AES key is sent to the server for authorized access.
 */
export async function uploadEncryptedProfileImage(
    file: File
): Promise<ProfileImageUploadResult> {
    // Encrypt the image with a random AES key
    const { encryptedData, aesKey, iv } = await encryptFileWithAes(file);

    // Create a new File with the encrypted data
    // Convert to ArrayBuffer to handle both ArrayBuffer and SharedArrayBuffer
    const sourceBuffer = encryptedData.buffer.slice(
        encryptedData.byteOffset,
        encryptedData.byteOffset + encryptedData.byteLength
    );
    // Copy to new ArrayBuffer to ensure it's not a SharedArrayBuffer
    const arrayBuffer = new ArrayBuffer(sourceBuffer.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(sourceBuffer));
    const encryptedFile = new File([arrayBuffer], file.name, { type: file.type });

    // Upload the encrypted file along with the AES key and IV
    const formData = new FormData();
    formData.append("file", encryptedFile);
    formData.append("aesKey", aesKey);
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
    // Fetch the AES key from the server
    // objectKey already includes the full path, so we use it directly
    const keyResponse = await fetch(`/api/profile-image/key/${objectKey}`);
    if (!keyResponse.ok) {
        throw new Error("Failed to fetch encryption key");
    }

    const keyData = await keyResponse.json() as { aesKey: string; iv: string; mimeType: string };
    const { aesKey: aesKeyBase64, iv: ivBase64, mimeType } = keyData;

    // Fetch the encrypted image
    // objectKey already includes the full path, so we use it directly
    const imageResponse = await fetch(`/api/profile-image/${objectKey}`);
    if (!imageResponse.ok) {
        throw new Error("Failed to fetch encrypted image");
    }

    const encryptedData = await imageResponse.arrayBuffer();

    // Decrypt the image
    const decryptedData = await decryptFileWithAes(encryptedData, aesKeyBase64, ivBase64);

    // Convert to ArrayBuffer to handle both ArrayBuffer and SharedArrayBuffer
    const sourceBuffer = decryptedData.buffer.slice(
        decryptedData.byteOffset,
        decryptedData.byteOffset + decryptedData.byteLength
    );
    // Copy to new ArrayBuffer to ensure it's not a SharedArrayBuffer
    const arrayBuffer = new ArrayBuffer(sourceBuffer.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(sourceBuffer));

    return new Blob([arrayBuffer], { type: mimeType });
}
