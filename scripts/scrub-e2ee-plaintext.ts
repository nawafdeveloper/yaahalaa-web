import "dotenv/config";
import db from "@/db";
import { chats, message } from "@/db/schema";
import { isNotNull } from "drizzle-orm";

async function main() {
    await db
        .update(message)
        .set({
            message_text_content: null,
        })
        .where(isNotNull(message.encrypted_content_ciphertext));

    await db
        .update(chats)
        .set({
            last_message_context: "",
        })
        .where(isNotNull(chats.encrypted_preview_ciphertext));

    console.log(
        "Scrubbed plaintext message bodies and chat previews for rows that already have encrypted payloads."
    );
}

void main().catch((error) => {
    console.error("Failed to scrub legacy plaintext E2EE data.");
    console.error(error);
    process.exit(1);
});
