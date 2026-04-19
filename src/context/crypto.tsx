"use client";

import { createContext, useContext, ReactNode, useState } from "react";
import { useCrypto } from "@/hooks/use-crypto";

interface CryptoContextType {
    publicKey: CryptoKey | null;
    privateKey: CryptoKey | null;
    isReady: boolean;
}

const CryptoContext = createContext<CryptoContextType>({
    publicKey: null,
    privateKey: null,
    isReady: false,
});

export function CryptoProvider({ children }: { children: ReactNode }) {
    const { state } = useCrypto();

    const isReady = state.status === "unlocked" && state.session !== null;
    const publicKey = state.status === "unlocked" ? state.session.publicKey : null;
    const privateKey = state.status === "unlocked" ? state.session.privateKey : null;

    return (
        <CryptoContext.Provider value={{ publicKey, privateKey, isReady }}>
            {children}
        </CryptoContext.Provider>
    );
}

export function useCryptoKeys() {
    const context = useContext(CryptoContext);
    return context;
}
