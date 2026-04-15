import { generateKeyPair } from "@/lib/crypto";

export interface StoredE2EEKeyPair {
    publicKey: string;
    privateKey: string;
    wasCreated: boolean;
}

export async function ensureStoredE2EEKeyPair(phone: string): Promise<StoredE2EEKeyPair> {
    const storedPub = localStorage.getItem(`pub_${phone}`);
    const storedPriv = localStorage.getItem(`priv_${phone}`);

    if (storedPub && storedPriv) {
        sessionStorage.setItem(`priv_${phone}`, storedPriv);

        return {
            publicKey: storedPub,
            privateKey: storedPriv,
            wasCreated: false,
        };
    }

    const { publicKey, privateKey } = await generateKeyPair();

    localStorage.setItem(`pub_${phone}`, publicKey);
    localStorage.setItem(`priv_${phone}`, privateKey);
    sessionStorage.setItem(`priv_${phone}`, privateKey);

    return {
        publicKey,
        privateKey,
        wasCreated: true,
    };
}
