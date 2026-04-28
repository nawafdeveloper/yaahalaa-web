CREATE TABLE "contacts" (
	"contact_id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"linked_user_id" text NOT NULL,
	"contact_ciphertext" text NOT NULL,
	"contact_encrypted_aes_key" text NOT NULL,
	"contact_iv" text NOT NULL,
	"contact_algorithm" text DEFAULT 'aes-256-gcm+rsa-oaep-sha256' NOT NULL,
	"normalized_phone_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_linked_user_id_user_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "contacts_ownerUserId_idx" ON "contacts" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "contacts_linkedUserId_idx" ON "contacts" USING btree ("linked_user_id");
--> statement-breakpoint
CREATE INDEX "contacts_phoneHash_idx" ON "contacts" USING btree ("normalized_phone_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_ownerLinkedUser_unique" ON "contacts" USING btree ("owner_user_id","linked_user_id");
