import { useState, useEffect, useCallback } from 'react';
import { generateKeyPair, encryptMessage, decryptMessage } from '@/lib/crypto';

interface PublicKeyResponse {
    publicKey: string;
}

interface MessageResponse {
    messages: Message[];
}

interface Message {
    id: string;
    sender_phone: string;
    ciphertext: string;
    nonce: string;
    timestamp: number;
}

export function useE2EE(currentPhone: string) {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [privateKeyRaw, setPrivateKeyRaw] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function init() {
            const storedPub = localStorage.getItem(`pub_${currentPhone}`);
            const storedPriv = localStorage.getItem(`priv_${currentPhone}`);

            if (storedPub && storedPriv) {
                setPublicKey(storedPub);
                setPrivateKeyRaw(storedPriv);
                sessionStorage.setItem(`priv_${currentPhone}`, storedPriv);
                if (mounted) setIsReady(true);
                return;
            }

            const { publicKey: pub, privateKey: priv } = await generateKeyPair();
            localStorage.setItem(`pub_${currentPhone}`, pub);
            localStorage.setItem(`priv_${currentPhone}`, priv);
            sessionStorage.setItem(`priv_${currentPhone}`, priv);
            setPublicKey(pub);
            setPrivateKeyRaw(priv);
            if (mounted) setIsReady(true);

            await fetch(`/api/users/${encodeURIComponent(currentPhone)}/public-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicKey: pub }),
            });
        }

        init();
        return () => { mounted = false; };
    }, [currentPhone]);

    const sendEncryptedMessage = useCallback(async (recipientPhone: string, plaintext: string) => {
        if (!privateKeyRaw || !isReady) throw new Error('E2EE not ready');
        const res = await fetch(`/api/users/${encodeURIComponent(recipientPhone)}/public-key`);
        if (!res.ok) throw new Error('Recipient public key not found');
        const data = await res.json() as PublicKeyResponse;
        const { publicKey: recipientPub } = data;
        const { ciphertext, nonce } = await encryptMessage(plaintext, recipientPub, privateKeyRaw);
        console.log('[E2EE] Encrypted message:', { ciphertext, nonce });
        await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderPhone: currentPhone,
                recipientPhone,
                ciphertext,
                nonce,
            }),
        });
    }, [currentPhone, privateKeyRaw, isReady]);

    const fetchAndDecryptMessages = useCallback(async () => {
        if (!privateKeyRaw || !isReady) return [];
        const res = await fetch(`/api/messages?phone=${encodeURIComponent(currentPhone)}`);
        const data = await res.json() as MessageResponse;
        const { messages } = data;
        const decrypted: (Message & { text: string })[] = [];
        for (const msg of messages) {
            try {
                const senderRes = await fetch(`/api/users/${encodeURIComponent(msg.sender_phone)}/public-key`);
                const senderData = await senderRes.json() as PublicKeyResponse;
                const { publicKey: senderPub } = senderData;
                const text = await decryptMessage(msg.ciphertext, msg.nonce, senderPub, privateKeyRaw);
                decrypted.push({ ...msg, text });
            } catch (err) {
                console.error(`Failed to decrypt message ${msg.id}`, err);
            }
        }
        return decrypted;
    }, [currentPhone, privateKeyRaw, isReady]);

    return {
        publicKey,
        isReady,
        sendEncryptedMessage,
        fetchAndDecryptMessages,
    };
}
