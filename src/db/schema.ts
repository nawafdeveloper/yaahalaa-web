import { relations } from "drizzle-orm";
import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    jsonb,
    index,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ChatItemType } from "@/types/chats.type";
import type { TextEncryptionAlgorithm } from "@/types/crypto";
import type {
    Contact,
    Event,
    Location,
    MessageReaction,
    OpenGraphData,
    Poll,
    ReplyMessage,
} from "@/types/messages.type";

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    phoneNumber: text("phone_number").unique(),
    phoneNumberVerified: boolean("phone_number_verified"),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
    whoCanSeeLastSeen: text("who_can_see_last_seen").default("all").notNull(),
    whoCanSeeProfilePicture: text("who_can_see_profile_picture")
        .default("all")
        .notNull(),
    whoCanSeeAbout: text("who_can_see_about").default("all").notNull(),
    whoCanSeeStatus: text("who_can_see_status").default("all").notNull(),
    enableReadReceipts: boolean("enable_read_receipts").default(true).notNull(),
    defaultMessageTimer: text("default_message_timer").default("24h").notNull(),
    totalBlockedContact: integer("total_blocked_contact").default(0).notNull(),
    enableAppLock: boolean("enable_app_lock").default(false).notNull(),
    blockUnknownAccount: boolean("block_unknown_account")
        .default(false)
        .notNull(),
    disableLinkPreview: boolean("disable_link_preview").default(false).notNull(),
    chatWallpaper: text("chat_wallpaper").default("wallpaper-1").notNull(),
    mediaUploadQuality: text("media_upload_quality").default("std").notNull(),
    imageMediaAutoDownload: boolean("image_media_auto_download")
        .default(false)
        .notNull(),
    videoMediaAutoDownload: boolean("video_media_auto_download")
        .default(false)
        .notNull(),
    voiceMediaAutoDownload: boolean("voice_media_auto_download")
        .default(false)
        .notNull(),
    fileMediaAutoDownload: boolean("file_media_auto_download")
        .default(false)
        .notNull(),
    disableMessagesNotifications: boolean("disable_messages_notifications")
        .default(false)
        .notNull(),
    disableGroupsNotifications: boolean("disable_groups_notifications")
        .default(false)
        .notNull(),
    yhlaPushToken: text("yhla_push_token").default("").notNull(),
    yhlaPublicKey: text("yhla_public_key").default("").notNull(),
    yhlaEncryptedPrivateKey: text("yhla_encrypted_private_key")
        .default("")
        .notNull(),
    yhlaPrivateKeyIv: text("yhla_private_key_iv").default("").notNull(),
    yhlaPinSalt: text("yhla_pin_salt").default("").notNull(),
    yhlaPinVerificationTag: text("yhla_pin_verification_tag")
        .default("")
        .notNull(),
    yhlaPinVerificationIv: text("yhla_pin_verification_iv").default("").notNull(),
    isNewUser: boolean("is_new_user").default(true).notNull(),
    aboutCiphertext: text("about_ciphertext").default("").notNull(),
    aboutEncryptedAesKey: text("about_encrypted_aes_key").default("").notNull(),
    aboutIv: text("about_iv").default("").notNull(),
});

export const session = pgTable(
    "session",
    {
        id: text("id").primaryKey(),
        expiresAt: timestamp("expires_at").notNull(),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
    },
    (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
    "account",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
    "verification",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const chats = pgTable(
    "chats",
    {
        chat_id: text("chat_id").primaryKey(),
        chat_type: text("chat_type")
            .$type<ChatItemType["chat_type"]>()
            .notNull(),
        avatar: text("avatar").notNull(),
        last_message_id: text("last_message_id"),
        encrypted_preview_ciphertext: text("encrypted_preview_ciphertext"),
        encrypted_preview_iv: text("encrypted_preview_iv"),
        encrypted_preview_algorithm: text("encrypted_preview_algorithm").$type<
            TextEncryptionAlgorithm | null
        >(),
        last_message_context: text("last_message_context").notNull(),
        last_message_media: text("last_message_media"),
        last_message_sender_is_me: boolean("last_message_sender_is_me")
            .default(false)
            .notNull(),
        last_message_sender_nickname: text(
            "last_message_sender_nickname"
        ).notNull(),
        is_unreaded_chat: boolean("is_unreaded_chat").default(false).notNull(),
        unreaded_messages_length: integer("unreaded_messages_length")
            .default(0)
            .notNull(),
        is_archived_chat: boolean("is_archived_chat").default(false).notNull(),
        is_muted_chat_notifications: boolean("is_muted_chat_notifications")
            .default(false)
            .notNull(),
        is_pinned_chat: boolean("is_pinned_chat").default(false).notNull(),
        is_favourite_chat: boolean("is_favourite_chat").default(false).notNull(),
        is_blocked_chat: boolean("is_blocked_chat").default(false).notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("chats_chatType_idx").on(table.chat_type),
        index("chats_updatedAt_idx").on(table.updated_at),
    ],
);

export const message = pgTable(
    "message",
    {
        message_id: text("message_id").primaryKey(),
        sender_user_id: text("sender_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        chat_room_id: text("chat_room_id")
            .notNull()
            .references(() => chats.chat_id, { onDelete: "cascade" }),
        encrypted_content_ciphertext: text("encrypted_content_ciphertext"),
        encrypted_content_iv: text("encrypted_content_iv"),
        encrypted_content_algorithm: text("encrypted_content_algorithm").$type<
            TextEncryptionAlgorithm | null
        >(),
        attached_media: text("attached_media").$type<
            | "photo"
            | "video"
            | "voice"
            | "file"
            | "contact"
            | "location"
            | null
        >(),
        event: jsonb("event").$type<Event | null>(),
        poll: jsonb("poll").$type<Poll | null>(),
        reply_message: jsonb("reply_message").$type<ReplyMessage | null>(),
        location: jsonb("location").$type<Location | null>(),
        media_url: text("media_url"),
        media_preview_url: text("media_preview_url"),
        media_size_bytes: integer("media_size_bytes"),
        video_thumbnail: text("video_thumbnail"),
        message_raction: jsonb("message_raction").$type<
            MessageReaction | null
        >(),
        is_forward_message: boolean("is_forward_message")
            .default(false)
            .notNull(),
        message_text_content: text("message_text_content"),
        open_graph_data: jsonb("open_graph_data").$type<
            OpenGraphData | null
        >(),
        user_ids_pin_it: text("user_ids_pin_it").array(),
        user_ids_star_it: text("user_ids_star_it").array(),
        deleted: boolean("deleted").default(false).notNull(),
        user_id_delete_it: text("user_id_delete_it"),
        edited: boolean("edited").default(false).notNull(),
        user_id_edit_it: text("user_id_edit_it"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        contact: jsonb("contact").$type<Contact | null>(),
    },
    (table) => [
        index("message_senderUserId_idx").on(table.sender_user_id),
        index("message_chatRoomId_idx").on(table.chat_room_id),
        index("message_createdAt_idx").on(table.created_at),
    ],
);

export const messageRecipientKeys = pgTable(
    "message_recipient_keys",
    {
        id: text("id").primaryKey(),
        message_id: text("message_id")
            .notNull()
            .references(() => message.message_id, { onDelete: "cascade" }),
        recipient_user_id: text("recipient_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        encrypted_aes_key: text("encrypted_aes_key").notNull(),
        algorithm: text("algorithm")
            .$type<TextEncryptionAlgorithm>()
            .default("aes-256-gcm+rsa-oaep-sha256")
            .notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("message_recipient_keys_messageId_idx").on(table.message_id),
        index("message_recipient_keys_recipientUserId_idx").on(
            table.recipient_user_id
        ),
        uniqueIndex("message_recipient_keys_messageRecipient_unique").on(
            table.message_id,
            table.recipient_user_id
        ),
    ]
);

export const chatRecipientKeys = pgTable(
    "chat_recipient_keys",
    {
        id: text("id").primaryKey(),
        chat_id: text("chat_id")
            .notNull()
            .references(() => chats.chat_id, { onDelete: "cascade" }),
        recipient_user_id: text("recipient_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        encrypted_aes_key: text("encrypted_aes_key").notNull(),
        algorithm: text("algorithm")
            .$type<TextEncryptionAlgorithm>()
            .default("aes-256-gcm+rsa-oaep-sha256")
            .notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("chat_recipient_keys_chatId_idx").on(table.chat_id),
        index("chat_recipient_keys_recipientUserId_idx").on(
            table.recipient_user_id
        ),
        uniqueIndex("chat_recipient_keys_chatRecipient_unique").on(
            table.chat_id,
            table.recipient_user_id
        ),
    ]
);

export const contacts = pgTable(
    "contacts",
    {
        contact_id: text("contact_id").primaryKey(),
        owner_user_id: text("owner_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        linked_user_id: text("linked_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        contact_ciphertext: text("contact_ciphertext").notNull(),
        contact_encrypted_aes_key: text("contact_encrypted_aes_key").notNull(),
        contact_iv: text("contact_iv").notNull(),
        contact_algorithm: text("contact_algorithm")
            .$type<TextEncryptionAlgorithm>()
            .default("aes-256-gcm+rsa-oaep-sha256")
            .notNull(),
        normalized_phone_hash: text("normalized_phone_hash").notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("contacts_ownerUserId_idx").on(table.owner_user_id),
        index("contacts_linkedUserId_idx").on(table.linked_user_id),
        index("contacts_phoneHash_idx").on(table.normalized_phone_hash),
        uniqueIndex("contacts_ownerLinkedUser_unique").on(
            table.owner_user_id,
            table.linked_user_id
        ),
    ]
);

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    messages: many(message),
    messageRecipientKeys: many(messageRecipientKeys),
    chatRecipientKeys: many(chatRecipientKeys),
    ownedContacts: many(contacts, {
        relationName: "contact_owner",
    }),
    linkedContacts: many(contacts, {
        relationName: "contact_linked_user",
    }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export const chatsRelations = relations(chats, ({ many, one }) => ({
    messages: many(message),
    lastMessage: one(message, {
        fields: [chats.last_message_id],
        references: [message.message_id],
        relationName: "chat_last_message",
    }),
    recipientKeys: many(chatRecipientKeys),
}));

export const messageRelations = relations(message, ({ many, one }) => ({
    sender: one(user, {
        fields: [message.sender_user_id],
        references: [user.id],
        relationName: "message_sender",
    }),
    chat: one(chats, {
        fields: [message.chat_room_id],
        references: [chats.chat_id],
    }),
    deletedBy: one(user, {
        fields: [message.user_id_delete_it],
        references: [user.id],
        relationName: "message_deleted_by",
    }),
    editedBy: one(user, {
        fields: [message.user_id_edit_it],
        references: [user.id],
        relationName: "message_edited_by",
    }),
    recipientKeys: many(messageRecipientKeys),
}));

export const messageRecipientKeysRelations = relations(
    messageRecipientKeys,
    ({ one }) => ({
        message: one(message, {
            fields: [messageRecipientKeys.message_id],
            references: [message.message_id],
        }),
        recipient: one(user, {
            fields: [messageRecipientKeys.recipient_user_id],
            references: [user.id],
            relationName: "message_recipient_key_user",
        }),
    })
);

export const chatRecipientKeysRelations = relations(chatRecipientKeys, ({ one }) => ({
    chat: one(chats, {
        fields: [chatRecipientKeys.chat_id],
        references: [chats.chat_id],
    }),
    recipient: one(user, {
        fields: [chatRecipientKeys.recipient_user_id],
        references: [user.id],
        relationName: "chat_recipient_key_user",
    }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
    owner: one(user, {
        fields: [contacts.owner_user_id],
        references: [user.id],
        relationName: "contact_owner",
    }),
    linkedUser: one(user, {
        fields: [contacts.linked_user_id],
        references: [user.id],
        relationName: "contact_linked_user",
    }),
}));

export const encryptedMedia = pgTable(
    "encrypted_media",
    {
        id: text("id").primaryKey(),
        ownerId: text("owner_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        objectKey: text("object_key").notNull().unique(),
        previewObjectKey: text("preview_object_key").unique(),
        aesKey: text("aes_key").notNull(), // Legacy single wrapped key or a JSON map of recipient-wrapped AES keys
        iv: text("iv").notNull(), // Base64 encoded AES-GCM IV
        mimeType: text("mime_type").notNull(),
        previewMimeType: text("preview_mime_type"),
        originalSizeBytes: integer("original_size_bytes").default(0).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("encrypted_media_ownerId_idx").on(table.ownerId),
        index("encrypted_media_objectKey_idx").on(table.objectKey),
        index("encrypted_media_previewObjectKey_idx").on(table.previewObjectKey),
    ]
);

export const schema = {
    user,
    session,
    account,
    verification,
    chats,
    message,
    messageRecipientKeys,
    chatRecipientKeys,
    contacts,
    encryptedMedia,
};
