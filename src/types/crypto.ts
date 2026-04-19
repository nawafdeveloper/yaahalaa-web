export interface UserKeyBundle {
    publicKey: string;
    encryptedPrivateKey: string;
    privateKeyIv: string;
    pinSalt: string;
    pinVerificationTag: string;
    pinVerificationIv: string;
}

export interface SessionKeys {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
}