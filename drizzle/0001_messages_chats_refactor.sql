DROP INDEX IF EXISTS "message_senderPhone_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "message_recipientPhone_idx";
--> statement-breakpoint
DROP TABLE IF EXISTS "message";
--> statement-breakpoint
CREATE TABLE "chats" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"chat_type" text NOT NULL,
	"avatar" text NOT NULL,
	"last_message_context" text NOT NULL,
	"last_message_media" text,
	"last_message_sender_is_me" boolean DEFAULT false NOT NULL,
	"last_message_sender_nickname" text NOT NULL,
	"is_unreaded_chat" boolean DEFAULT false NOT NULL,
	"unreaded_messages_length" integer DEFAULT 0 NOT NULL,
	"is_archived_chat" boolean DEFAULT false NOT NULL,
	"is_muted_chat_notifications" boolean DEFAULT false NOT NULL,
	"is_pinned_chat" boolean DEFAULT false NOT NULL,
	"is_favourite_chat" boolean DEFAULT false NOT NULL,
	"is_blocked_chat" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"message_id" text PRIMARY KEY NOT NULL,
	"sender_user_id" text NOT NULL,
	"chat_room_id" text NOT NULL,
	"attached_media" text,
	"event" jsonb,
	"poll" jsonb,
	"reply_message" jsonb,
	"location" jsonb,
	"media_url" text,
	"video_thumbnail" text,
	"message_raction" jsonb,
	"is_forward_message" boolean DEFAULT false NOT NULL,
	"message_text_content" text,
	"open_graph_data" jsonb,
	"user_ids_pin_it" text[],
	"user_ids_star_it" text[],
	"deleted" boolean DEFAULT false NOT NULL,
	"user_id_delete_it" text,
	"edited" boolean DEFAULT false NOT NULL,
	"user_id_edit_it" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"contact" jsonb,
	CONSTRAINT "message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "message_chat_room_id_chats_chat_id_fk" FOREIGN KEY ("chat_room_id") REFERENCES "public"."chats"("chat_id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "chats_chatType_idx" ON "chats" USING btree ("chat_type");
--> statement-breakpoint
CREATE INDEX "chats_updatedAt_idx" ON "chats" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "message_senderUserId_idx" ON "message" USING btree ("sender_user_id");
--> statement-breakpoint
CREATE INDEX "message_chatRoomId_idx" ON "message" USING btree ("chat_room_id");
--> statement-breakpoint
CREATE INDEX "message_createdAt_idx" ON "message" USING btree ("created_at");
