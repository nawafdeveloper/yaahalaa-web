ALTER TABLE "chats" ADD COLUMN "last_message_id" text;
--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "encrypted_preview_ciphertext" text;
--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "encrypted_preview_iv" text;
--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "encrypted_preview_algorithm" text;
--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "encrypted_content_ciphertext" text;
--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "encrypted_content_iv" text;
--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "encrypted_content_algorithm" text;
--> statement-breakpoint
CREATE TABLE "message_recipient_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"encrypted_aes_key" text NOT NULL,
	"algorithm" text DEFAULT 'aes-256-gcm+rsa-oaep-sha256' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_recipient_keys_message_id_message_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("message_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "message_recipient_keys_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "chat_recipient_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"encrypted_aes_key" text NOT NULL,
	"algorithm" text DEFAULT 'aes-256-gcm+rsa-oaep-sha256' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_recipient_keys_chat_id_chats_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "chat_recipient_keys_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "message_recipient_keys_messageId_idx" ON "message_recipient_keys" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX "message_recipient_keys_recipientUserId_idx" ON "message_recipient_keys" USING btree ("recipient_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "message_recipient_keys_messageRecipient_unique" ON "message_recipient_keys" USING btree ("message_id","recipient_user_id");
--> statement-breakpoint
CREATE INDEX "chat_recipient_keys_chatId_idx" ON "chat_recipient_keys" USING btree ("chat_id");
--> statement-breakpoint
CREATE INDEX "chat_recipient_keys_recipientUserId_idx" ON "chat_recipient_keys" USING btree ("recipient_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_recipient_keys_chatRecipient_unique" ON "chat_recipient_keys" USING btree ("chat_id","recipient_user_id");
