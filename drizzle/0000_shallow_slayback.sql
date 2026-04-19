CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encrypted_media" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"object_key" text NOT NULL,
	"aes_key" text NOT NULL,
	"iv" text NOT NULL,
	"mime_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "encrypted_media_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_phone" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"phone_number" text,
	"phone_number_verified" boolean,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"who_can_see_last_seen" text DEFAULT 'all' NOT NULL,
	"who_can_see_profile_picture" text DEFAULT 'all' NOT NULL,
	"who_can_see_about" text DEFAULT 'all' NOT NULL,
	"who_can_see_status" text DEFAULT 'all' NOT NULL,
	"enable_read_receipts" boolean DEFAULT true NOT NULL,
	"default_message_timer" text DEFAULT '24h' NOT NULL,
	"total_blocked_contact" integer DEFAULT 0 NOT NULL,
	"enable_app_lock" boolean DEFAULT false NOT NULL,
	"block_unknown_account" boolean DEFAULT false NOT NULL,
	"disable_link_preview" boolean DEFAULT false NOT NULL,
	"chat_wallpaper" text DEFAULT 'wallpaper-1' NOT NULL,
	"media_upload_quality" text DEFAULT 'std' NOT NULL,
	"image_media_auto_download" boolean DEFAULT false NOT NULL,
	"video_media_auto_download" boolean DEFAULT false NOT NULL,
	"voice_media_auto_download" boolean DEFAULT false NOT NULL,
	"file_media_auto_download" boolean DEFAULT false NOT NULL,
	"disable_messages_notifications" boolean DEFAULT false NOT NULL,
	"disable_groups_notifications" boolean DEFAULT false NOT NULL,
	"yhla_push_token" text DEFAULT '' NOT NULL,
	"yhla_public_key" text DEFAULT '' NOT NULL,
	"yhla_encrypted_private_key" text DEFAULT '' NOT NULL,
	"yhla_private_key_iv" text DEFAULT '' NOT NULL,
	"yhla_pin_salt" text DEFAULT '' NOT NULL,
	"yhla_pin_verification_tag" text DEFAULT '' NOT NULL,
	"yhla_pin_verification_iv" text DEFAULT '' NOT NULL,
	"is_new_user" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encrypted_media" ADD CONSTRAINT "encrypted_media_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "encrypted_media_ownerId_idx" ON "encrypted_media" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "encrypted_media_objectKey_idx" ON "encrypted_media" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "message_senderPhone_idx" ON "message" USING btree ("sender_phone");--> statement-breakpoint
CREATE INDEX "message_recipientPhone_idx" ON "message" USING btree ("recipient_phone");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");