import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";

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

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
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
