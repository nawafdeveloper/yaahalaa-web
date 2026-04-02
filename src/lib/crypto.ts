import nacl from 'tweetnacl';
import { encode as b64Encode, decode as b64Decode } from '@stablelib/base64';

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const kp = nacl.box.keyPair();
    return {
        publicKey: b64Encode(kp.publicKey),
        privateKey: b64Encode(kp.secretKey),
    };
}

export async function encryptMessage(
    plaintext: string,
    recipientPublicKeyB64: string,
    senderSecretKeyB64: string
): Promise<{ ciphertext: string; nonce: string }> {
    const recipientPub = b64Decode(recipientPublicKeyB64);
    const senderSec = b64Decode(senderSecretKeyB64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const msgUint8 = new TextEncoder().encode(plaintext);
    const ciphertext = nacl.box(msgUint8, nonce, recipientPub, senderSec);
    return {
        ciphertext: `yhla_${b64Encode(ciphertext)}`,
        nonce: b64Encode(nonce),
    };
}

export async function decryptMessage(
    ciphertextB64: string,
    nonceB64: string,
    senderPublicKeyB64: string,
    recipientSecretKeyB64: string
): Promise<string> {
    if (!ciphertextB64.startsWith('yhla_')) {
        throw new Error('Invalid ciphertext branding');
    }
    const cleanedCiphertext = ciphertextB64.slice('yhla_'.length);
    const ciphertext = b64Decode(cleanedCiphertext);
    const nonce = b64Decode(nonceB64);
    const senderPub = b64Decode(senderPublicKeyB64);
    const recipientSec = b64Decode(recipientSecretKeyB64);
    const decrypted = nacl.box.open(ciphertext, nonce, senderPub, recipientSec);
    if (!decrypted) throw new Error('Decryption failed – wrong key or tampered data');
    return new TextDecoder().decode(decrypted);
}

export async function importPrivateKey(privateKeyB64: string): Promise<CryptoKey> {
    const rawKey = b64Decode(privateKeyB64);
    const keyBytes = new Uint8Array(rawKey);
    return await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits']
    );
}
