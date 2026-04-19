"use client";

import { useEffect, useState } from "react";
import PinCode from "./pin-code";

export default function PinCodeWrapper() {
    const [showPinCode, setShowPinCode] = useState<boolean | null>(null);

    useEffect(() => {
        const SESSION_KEYS_STORAGE_KEY = "yhla_session_keys";
        const hasKeys = localStorage.getItem(SESSION_KEYS_STORAGE_KEY) !== null;
        
        // If keys already exist, user is already unlocked - don't show PIN screen
        setShowPinCode(!hasKeys);
    }, []);

    // While checking, show nothing
    if (showPinCode === null) {
        return null;
    }

    // If keys exist, don't show PIN screen
    if (!showPinCode) {
        return null;
    }

    return <PinCode />;
}
