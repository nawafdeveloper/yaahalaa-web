"use client";

import { useEffect, useState } from "react";
import { fetchAndDecryptMessageMedia } from "@/lib/message-media-upload";
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";

export function useDecryptedMessageMedia(mediaUrl?: string | null) {
    const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isActive = true;
        let objectUrl: string | null = null;

        if (!mediaUrl) {
            setDecryptedUrl(null);
            setMimeType(null);
            setLoading(false);
            setError(null);
            return;
        }

        const parsed = parseManagedMessageMediaUrl(mediaUrl);
        if (!parsed) {
            setDecryptedUrl(mediaUrl);
            setMimeType(null);
            setLoading(false);
            setError(null);
            return;
        }

        const fetchAndDecrypt = async () => {
            try {
                setLoading(true);
                setError(null);

                const blob = await fetchAndDecryptMessageMedia(parsed.objectKey);
                if (!isActive) {
                    return;
                }

                objectUrl = URL.createObjectURL(blob);
                setMimeType(blob.type || null);
                setDecryptedUrl(objectUrl);
            } catch (err) {
                if (!isActive) {
                    return;
                }

                setError(
                    err instanceof Error
                        ? err
                        : new Error("Failed to decrypt message media")
                );
                setMimeType(null);
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
    }, [mediaUrl]);

    return { decryptedUrl, mimeType, loading, error };
}
