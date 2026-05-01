"use client";

import { useEffect, useMemo, useState } from "react";
import { useCryptoKeys } from "@/context/crypto";
import { fetchAndDecryptProfileImage } from "@/lib/profile-image-upload";
import { parseManagedProfileImageUrl } from "@/lib/profile-image-url";
import { logMediaDebug } from "@/lib/message-media-debug";

export function useDecryptedProfileImage(imageUrl?: string | null) {
    const { isHydrated, isReady } = useCryptoKeys();
    const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const parsedManagedImage = useMemo(
        () => parseManagedProfileImageUrl(imageUrl),
        [imageUrl]
    );

    useEffect(() => {
        let isActive = true;
        let objectUrl: string | null = null;

        if (!imageUrl) {
            setDecryptedUrl(null);
            setLoading(false);
            setError(null);
            return;
        }

        if (!parsedManagedImage) {
            setDecryptedUrl(imageUrl);
            setLoading(false);
            setError(null);
            return;
        }

        if (!isHydrated) {
            setDecryptedUrl(null);
            setLoading(true);
            setError(null);
            return;
        }

        if (!isReady) {
            logMediaDebug("client.profile-image.hook.keys-locked", {
                objectKey: parsedManagedImage.objectKey,
            });
            setDecryptedUrl(null);
            setLoading(false);
            setError(new Error("Profile image decryption keys are locked."));
            return;
        }

        const fetchAndDecrypt = async () => {
            try {
                setLoading(true);
                setError(null);
                logMediaDebug("client.profile-image.hook.load-start", {
                    objectKey: parsedManagedImage.objectKey,
                });

                const blob = await fetchAndDecryptProfileImage(
                    parsedManagedImage.objectKey
                );
                if (!isActive) {
                    return;
                }

                objectUrl = URL.createObjectURL(blob);
                setDecryptedUrl(objectUrl);
                logMediaDebug("client.profile-image.hook.load-success", {
                    objectKey: parsedManagedImage.objectKey,
                    mimeType: blob.type || null,
                    size: blob.size,
                });
            } catch (err) {
                if (!isActive) {
                    return;
                }

                setError(err instanceof Error ? err : new Error("Failed to decrypt profile image"));
                logMediaDebug("client.profile-image.hook.load-failed", {
                    objectKey: parsedManagedImage.objectKey,
                    error:
                        err instanceof Error
                            ? err.message
                            : "Failed to decrypt profile image",
                });
                setDecryptedUrl(null);
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        void fetchAndDecrypt();

        return () => {
            isActive = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [imageUrl, isHydrated, isReady, parsedManagedImage]);

    return { decryptedUrl, loading, error };
}
