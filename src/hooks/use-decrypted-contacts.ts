"use client";

import { useEffect } from "react";
import { useCryptoKeys } from "@/context/crypto";
import { authClient } from "@/lib/auth-client";
import { decryptStoredContact } from "@/lib/contact-crypto";
import { useContactDirectoryStore } from "@/store/use-contact-directory-store";
import type { Contact, StoredContactRecord } from "@/types/contacts.type";

export function useDecryptedContacts() {
    const { isReady } = useCryptoKeys();
    const { data: session } = authClient.useSession();
    const contacts = useContactDirectoryStore((state) => state.contacts);
    const isLoading = useContactDirectoryStore((state) => state.isLoading);
    const error = useContactDirectoryStore((state) => state.error);
    const loadedForUserId = useContactDirectoryStore(
        (state) => state.loadedForUserId
    );
    const setContacts = useContactDirectoryStore((state) => state.setContacts);
    const setLoading = useContactDirectoryStore((state) => state.setLoading);
    const setError = useContactDirectoryStore((state) => state.setError);
    const reset = useContactDirectoryStore((state) => state.reset);

    const currentUserId = session?.user.id ?? null;

    useEffect(() => {
        if (!currentUserId) {
            reset();
            return;
        }

        if (!isReady) {
            return;
        }

        let isActive = true;

        const loadContacts = async (force = false) => {
            if (isLoading) {
                return;
            }

            if (!force && loadedForUserId === currentUserId && contacts.length > 0) {
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const response = await fetch("/api/contacts", {
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("Failed to load contacts.");
                }

                const payload = (await response.json()) as {
                    contacts: StoredContactRecord[];
                };

                const decryptedContacts = await Promise.all(
                    payload.contacts.map(async (contactRecord) => {
                        try {
                            return await decryptStoredContact(contactRecord);
                        } catch {
                            return null;
                        }
                    })
                );

                if (!isActive) {
                    return;
                }

                setContacts(
                    currentUserId,
                    decryptedContacts.filter(
                        (contact): contact is Contact => contact !== null
                    )
                );
            } catch (nextError) {
                if (!isActive) {
                    return;
                }

                setError(
                    nextError instanceof Error
                        ? nextError.message
                        : "Failed to load contacts."
                );
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        const handleContactsChanged = () => {
            void loadContacts(true);
        };

        void loadContacts();
        window.addEventListener("contacts:changed", handleContactsChanged);

        return () => {
            isActive = false;
            window.removeEventListener("contacts:changed", handleContactsChanged);
        };
    }, [
        contacts.length,
        currentUserId,
        isLoading,
        isReady,
        loadedForUserId,
        reset,
        setContacts,
        setError,
        setLoading,
    ]);

    return {
        contacts,
        isLoading,
        error,
    };
}
