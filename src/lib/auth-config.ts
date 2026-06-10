import type { DBFieldAttribute } from "better-auth/db";
import { phoneNumber } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { electron } from "@better-auth/electron";
import { sendAuthenticaMessage } from "@/utils/send-authentica-message";
import { enforcePhoneOtpRateLimit } from "@/lib/auth-rate-limit";
import { getAuthTrustedOrigins } from "@/lib/security-policy";

type UserAdditionalFields = Record<string, DBFieldAttribute>;

export const userAdditionalFields = {
    lastSeen: {
        type: "date",
        input: true,
        defaultValue: () => new Date(),
    },
    whoCanSeeLastSeen: {
        type: "string",
        input: true,
        defaultValue: "all",
    },
    whoCanSeeProfilePicture: {
        type: "string",
        input: true,
        defaultValue: "all",
    },
    whoCanSeeAbout: {
        type: "string",
        input: true,
        defaultValue: "all",
    },
    whoCanSeeStatus: {
        type: "string",
        input: true,
        defaultValue: "all",
    },
    enableReadReceipts: {
        type: "boolean",
        input: true,
        defaultValue: true,
    },
    defaultMessageTimer: {
        type: "string",
        input: true,
        defaultValue: "24h",
    },
    totalBlockedContact: {
        type: "number",
        input: true,
        defaultValue: 0,
    },
    enableAppLock: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    blockUnknownAccount: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    disableLinkPreview: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    chatWallpaper: {
        type: "string",
        input: true,
        defaultValue: "wallpaper-1",
    },
    mediaUploadQuality: {
        type: "string",
        input: true,
        defaultValue: "std",
    },
    imageMediaAutoDownload: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    videoMediaAutoDownload: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    voiceMediaAutoDownload: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    fileMediaAutoDownload: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    disableMessagesNotifications: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    disableGroupsNotifications: {
        type: "boolean",
        input: true,
        defaultValue: false,
    },
    yhlaPushToken: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    yhlaPublicKey: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    yhlaEncryptedPrivateKey: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    yhlaPrivateKeyIv: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    yhlaPinSalt: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    yhlaPinVerificationTag: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    yhlaPinVerificationIv: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    isNewUser: {
        type: "boolean",
        input: true,
        defaultValue: true
    },
    aboutCiphertext: {
        type: 'string',
        input: true,
        defaultValue: ''
    },
    aboutEncryptedAesKey: {
        type: 'string',
        input: true,
        defaultValue: ''
    },
    aboutIv: {
        type: 'string',
        input: true,
        defaultValue: ''
    },
} satisfies UserAdditionalFields;

function isValidOtpPhoneNumber(phoneNumber: string) {
    return /^\+[1-9]\d{7,14}$/.test(normalizeOtpPhoneNumber(phoneNumber));
}

function normalizeOtpPhoneNumber(phoneNumber: string) {
    return phoneNumber.trim().replace(/[^\d+]/g, "");
}

export const authSharedOptions = {
    plugins: [
        phoneNumber({
            allowedAttempts: 3,
            expiresIn: 5 * 60,
            otpLength: 6,
            phoneNumberValidator: isValidOtpPhoneNumber,
            sendOTP: async ({ phoneNumber, code }) => {
                const normalizedPhoneNumber = normalizeOtpPhoneNumber(phoneNumber);
                await enforcePhoneOtpRateLimit(normalizedPhoneNumber);
                await sendAuthenticaMessage({
                    phone: normalizedPhoneNumber,
                    otp: code,
                });
            },
            signUpOnVerification: {
                getTempEmail: (phoneNumber) => `${phoneNumber}@yaahalaa.com`,
                getTempName: () => "",
            },
        }),
        expo(),
        electron()
    ],
    trustedOrigins: () => getAuthTrustedOrigins(),
    rateLimit: {
        enabled: true,
        storage: "database" as const,
        window: 60,
        max: 120,
        customRules: {
            "/phone-number/send-otp": {
                window: 60,
                max: 3,
            },
            "/phone-number/verify": {
                window: 60,
                max: 5,
            },
            "/sign-in/phone-number": {
                window: 60,
                max: 5,
            },
            "/phone-number/request-password-reset": {
                window: 60,
                max: 3,
            },
            "/phone-number/reset-password": {
                window: 60,
                max: 5,
            },
        },
    },
    advanced: {
        ipAddress: {
            ipAddressHeaders: [
                "cf-connecting-ip",
                "x-forwarded-for",
                "x-real-ip",
            ],
            ipv6Subnet: 64,
        },
    },
    user: {
        additionalFields: userAdditionalFields,
    },
};
