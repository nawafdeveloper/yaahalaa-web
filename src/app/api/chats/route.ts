import { auth } from "@/lib/auth";
import db from "@/db";
import {
    chatRecipientKeys,
    chats,
    message,
    messageRecipientKeys,
    user,
} from "@/db/schema";
import {
    buildPhoneLookupVariants,
    phoneValuesMatch,
} from "@/lib/contact-utils";
import { desc, eq, inArray, like } from "drizzle-orm";
import type { RecipientEncryptedAesKey } from "@/types/crypto";

interface UserWithPhone {
    id: string;
    phoneNumber?: string | null;
}

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as unknown as UserWithPhone;
    const participantChatIds = new Set<string>();

    const sentChats = await db
        .selectDistinct({ chatId: message.chat_room_id })
        .from(message)
        .where(eq(message.sender_user_id, sessionUser.id));
    for (const row of sentChats) {
        participantChatIds.add(row.chatId);
    }

    const chatKeyRows = await db
        .select({ chatId: chatRecipientKeys.chat_id })
        .from(chatRecipientKeys)
        .where(eq(chatRecipientKeys.recipient_user_id, sessionUser.id));
    for (const row of chatKeyRows) {
        participantChatIds.add(row.chatId);
    }

    const receivedMessageKeys = await db
        .select({ messageId: messageRecipientKeys.message_id })
        .from(messageRecipientKeys)
        .where(eq(messageRecipientKeys.recipient_user_id, sessionUser.id));
    if (receivedMessageKeys.length > 0) {
        const receivedChats = await db
            .selectDistinct({ chatId: message.chat_room_id })
            .from(message)
            .where(
                inArray(
                    message.message_id,
                    receivedMessageKeys.map((row) => row.messageId)
                )
            );
        for (const row of receivedChats) {
            participantChatIds.add(row.chatId);
        }
    }

    if (sessionUser.phoneNumber) {
        const phoneChats = await db
            .select({ chatId: chats.chat_id })
            .from(chats)
            .where(like(chats.chat_id, `%${sessionUser.phoneNumber}%`));
        for (const row of phoneChats) {
            participantChatIds.add(row.chatId);
        }
    }

    if (participantChatIds.size === 0) {
        return Response.json({ chats: [] });
    }

    const chatIds = [...participantChatIds];
    const rows = await db
        .select()
        .from(chats)
        .where(inArray(chats.chat_id, chatIds))
        .orderBy(desc(chats.updated_at));

    const directPartnerPhones = sessionUser.phoneNumber
        ? rows
              .filter((chat) => chat.chat_type === "single")
              .map((chat) =>
                  chat.chat_id
                      .split("::")
                      .find(
                          (participant) =>
                              !phoneValuesMatch(
                                  participant,
                                  sessionUser.phoneNumber
                              )
                      )
              )
              .filter((phone): phone is string => Boolean(phone))
        : [];
    const directPartnerPhoneVariants = [
        ...new Set(
            directPartnerPhones.flatMap((phone) => buildPhoneLookupVariants(phone))
        ),
    ];
    const partnerUsers =
        directPartnerPhones.length > 0
            ? await db
                  .select({
                      id: user.id,
                      phoneNumber: user.phoneNumber,
                      image: user.image,
                      publicKey: user.yhlaPublicKey,
                  })
                  .from(user)
                  .where(inArray(user.phoneNumber, directPartnerPhoneVariants))
            : [];
    const partnerUsersByPhoneVariant = new Map<string, (typeof partnerUsers)[number]>();
    for (const partner of partnerUsers) {
        for (const variant of buildPhoneLookupVariants(partner.phoneNumber ?? "")) {
            partnerUsersByPhoneVariant.set(variant, partner);
        }
    }

    const recipientKeys = await db
        .select()
        .from(chatRecipientKeys)
        .where(eq(chatRecipientKeys.recipient_user_id, sessionUser.id));
    const keysByChatId = new Map<string, RecipientEncryptedAesKey[]>();
    for (const key of recipientKeys) {
        const existing = keysByChatId.get(key.chat_id) ?? [];
        existing.push({
            recipient_user_id: key.recipient_user_id,
            encrypted_aes_key: key.encrypted_aes_key,
            algorithm: key.algorithm,
        });
        keysByChatId.set(key.chat_id, existing);
    }

    return Response.json({
        chats: rows.map((chat) => ({
            ...chat,
            ...(chat.chat_type === "single" && sessionUser.phoneNumber
                ? (() => {
                      const partnerPhone = chat.chat_id
                          .split("::")
                          .find(
                              (participant) =>
                                  !phoneValuesMatch(
                                      participant,
                                      sessionUser.phoneNumber
                                  )
                          ) ?? null;
                      const partner = partnerPhone
                          ? buildPhoneLookupVariants(partnerPhone)
                                .map((variant) =>
                                    partnerUsersByPhoneVariant.get(variant)
                                )
                                .find(Boolean) ?? null
                          : null;

                      return {
                          avatar: partner?.image ?? chat.avatar,
                          recipient_user_id: partner?.id ?? null,
                          recipient_public_key: partner?.publicKey ?? null,
                          contact_phone: partner?.phoneNumber ?? partnerPhone,
                      };
                  })()
                : {}),
            chat_recipient_keys: keysByChatId.get(chat.chat_id) ?? null,
        })),
    });
}
