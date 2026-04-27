"use client";

import { useEffect, useState } from "react";
import { fetchAndDecryptProfileImage } from "@/lib/profile-image-upload";
import { parseManagedProfileImageUrl } from "@/lib/profile-image-url";

export function useDecryptedProfileImage(imageUrl?: string | null) {
    const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isActive = true;
        let objectUrl: string | null = null;

        if (!imageUrl) {
            setDecryptedUrl(null);
            setLoading(false);
            setError(null);
            return;
        }

        const parsed = parseManagedProfileImageUrl(imageUrl);
        if (!parsed) {
            setDecryptedUrl(imageUrl);
            setLoading(false);
            setError(null);
            return;
        }

        const fetchAndDecrypt = async () => {
            try {
                setLoading(true);
                setError(null);

                const blob = await fetchAndDecryptProfileImage(parsed.objectKey);
                if (!isActive) {
                    return;
                }

                objectUrl = URL.createObjectURL(blob);
                setDecryptedUrl(objectUrl);
            } catch (err) {
                if (!isActive) {
                    return;
                }

                setError(err instanceof Error ? err : new Error("Failed to decrypt profile image"));
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
    }, [imageUrl]);

    return { decryptedUrl, loading, error };
}
