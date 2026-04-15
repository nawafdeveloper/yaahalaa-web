import type { DBFieldAttribute } from "better-auth/client"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields, phoneNumberClient } from "better-auth/client/plugins"

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
    yhlaPublic: {
        type: "string",
        input: true,
        defaultValue: ""
    },
    yhlaPushToken: {
        type: "string",
        input: true,
        defaultValue: ""
    }
} satisfies UserAdditionalFields;

export const authClient = createAuthClient({
    plugins: [
        phoneNumberClient(),
        inferAdditionalFields({
            user: {
                ...userAdditionalFields,
            },
        }),
    ]
})
