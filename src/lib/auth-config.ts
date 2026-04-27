import type { DBFieldAttribute } from "better-auth/db";
import { phoneNumber } from "better-auth/plugins";
import { expo } from "@better-auth/expo";

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

export const authSharedOptions = {
    plugins: [
        phoneNumber({
            sendOTP: ({ code }) => {
                console.log("OTP: ", code);
            },
            signUpOnVerification: {
                getTempEmail: (phoneNumber) => `${phoneNumber}@yaahalaa.com`,
                getTempName: () => "",
            },
        }),
        expo()
    ],
    user: {
        additionalFields: userAdditionalFields,
    },
    advanced: {
        disableCSRFCheck: true,
    },
};
