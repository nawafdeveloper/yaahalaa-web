"use client";

import { useEffect, useState } from "react";
import { fetchAndDecryptProfileImage } from "@/lib/profile-image-upload";
import { parseManagedProfileImageUrl } from "@/lib/profile-image-url";

export function useDecryptedProfileImage(imageUrl?: string | null) {
    const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!imageUrl) {
            setDecryptedUrl(null);
            setError(null);
            return;
        }

        // Check if this is a managed profile image URL
        const parsed = parseManagedProfileImageUrl(imageUrl);
        if (!parsed) {
            // Not a managed URL, use as-is
            setDecryptedUrl(imageUrl);
            setError(null);
            return;
        }

        const fetchAndDecrypt = async () => {
            try {
                setLoading(true);
                setError(null);

                const blob = await fetchAndDecryptProfileImage(parsed.objectKey);
                const url = URL.createObjectURL(blob);
                setDecryptedUrl(url);

                return () => {
                    URL.revokeObjectURL(url);
                };
            } catch (err) {
                setError(err instanceof Error ? err : new Error("Failed to decrypt profile image"));
                setDecryptedUrl(null);
            } finally {
                setLoading(false);
            }
        };

        const cleanupPromise = fetchAndDecrypt();

        return () => {
            cleanupPromise.then((cleanup) => {
                cleanup?.();
            });
        };
    }, [imageUrl]);

    return { decryptedUrl, loading, error };
}
