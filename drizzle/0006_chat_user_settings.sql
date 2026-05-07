CREATE TABLE "chat_user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"user_id" text NOT NULL,
	"is_archived_chat" boolean DEFAULT false NOT NULL,
	"is_muted_chat_notifications" boolean DEFAULT false NOT NULL,
	"is_pinned_chat" boolean DEFAULT false NOT NULL,
	"is_favourite_chat" boolean DEFAULT false NOT NULL,
	"is_blocked_chat" boolean DEFAULT false NOT NULL,
	"is_deleted_chat" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "chat_user_settings" ADD CONSTRAINT "chat_user_settings_chat_id_chats_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chat_user_settings" ADD CONSTRAINT "chat_user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "chat_user_settings_chatId_idx" ON "chat_user_settings" USING btree ("chat_id");
CREATE INDEX "chat_user_settings_userId_idx" ON "chat_user_settings" USING btree ("user_id");
CREATE UNIQUE INDEX "chat_user_settings_chatUser_unique" ON "chat_user_settings" USING btree ("chat_id","user_id");
