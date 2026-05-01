import { auth } from "@/lib/auth";
import db from "@/db";
import { getUnreadCountsByChatId } from "@/lib/chat-read-state";
import { isManagedProfileImageUrl } from "@/lib/profile-image-url";
import {
    chatRecipientKeys,
    chatReadStates,
    chats,
    contacts,
    encryptedMedia,
    message,
    messageRecipientKeys,
    user,
} from "@/db/schema";
import {
    buildPhoneLookupVariants,
    phoneValuesMatch,
} from "@/lib/contact-utils";
import {
    parseRecipientMediaKeyMap,
    userHasDirectMediaRecipientKey,
} from "@/lib/message-media-access";
import {
    canViewAbout,
    canViewLastSeen,
    canViewProfilePicture,
} from "@/lib/profile-picture-privacy";
import { parseManagedProfileImageUrl } from "@/lib/profile-image-url";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import type { RecipientEncryptedAesKey } from "@/types/crypto";

interface UserWithPhone {
    id: string;
    phoneNumber?: string | null;
}

function getSafeAvatarUrl(value?: string | null): string {
    if (!value || isManagedProfileImageUrl(value)) {
        return "";
    }

    return value;
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
    const unreadCountsByChatId = await getUnreadCountsByChatId({
        chatIds: rows.map((row) => row.chat_id),
        userId: sessionUser.id,
    });
    const lastMessageIds = [
        ...new Set(
            rows
                .map((row) => row.last_message_id)
                .filter((messageId): messageId is string => Boolean(messageId))
        ),
    ];
    const lastMessageRows =
        lastMessageIds.length > 0
            ? await db
                  .select({
                      messageId: message.message_id,
                      chatId: message.chat_room_id,
                      senderUserId: message.sender_user_id,
                      createdAt: message.created_at,
                  })
                  .from(message)
                  .where(inArray(message.message_id, lastMessageIds))
            : [];
    const lastMessageById = new Map(
        lastMessageRows.map((row) => [row.messageId, row])
    );
    const lastMessageRecipientKeyRows =
        lastMessageIds.length > 0
            ? await db
                  .select({
                      messageId: messageRecipientKeys.message_id,
                      recipientUserId: messageRecipientKeys.recipient_user_id,
                  })
                  .from(messageRecipientKeys)
                  .where(inArray(messageRecipientKeys.message_id, lastMessageIds))
            : [];
    const recipientUserIdsByLastMessageId = new Map<string, string[]>();
    for (const key of lastMessageRecipientKeyRows) {
        const existing =
            recipientUserIdsByLastMessageId.get(key.messageId) ?? [];

        if (!existing.includes(key.recipientUserId)) {
            existing.push(key.recipientUserId);
        }

        recipientUserIdsByLastMessageId.set(key.messageId, existing);
    }
    const readStateRows =
        rows.length > 0
            ? await db
                  .select({
                      chatId: chatReadStates.chat_id,
                      userId: chatReadStates.user_id,
                      lastReadAt: chatReadStates.last_read_at,
                  })
                  .from(chatReadStates)
                  .where(
                      inArray(
                          chatReadStates.chat_id,
                          rows.map((row) => row.chat_id)
                      )
                  )
            : [];
    const readStatesByChatId = new Map<
        string,
        { userId: string; lastReadAt: Date }[]
    >();
    for (const readState of readStateRows) {
        const existing = readStatesByChatId.get(readState.chatId) ?? [];
        existing.push({
            userId: readState.userId,
            lastReadAt: readState.lastReadAt,
        });
        readStatesByChatId.set(readState.chatId, existing);
    }

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
                      lastSeen: user.lastSeen,
                      whoCanSeeLastSeen: user.whoCanSeeLastSeen,
                      whoCanSeeStatus: user.whoCanSeeStatus,
                      whoCanSeeProfilePicture: user.whoCanSeeProfilePicture,
                      whoCanSeeAbout: user.whoCanSeeAbout,
                      aboutCiphertext: user.aboutCiphertext,
                      aboutEncryptedAesKey: user.aboutEncryptedAesKey,
                      aboutIv: user.aboutIv,
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
    const partnerUserIds = [...new Set(partnerUsers.map((partner) => partner.id))];
    const partnerProfileImageObjectKeys = [
        ...new Set(
            partnerUsers
                .map((partner) => parseManagedProfileImageUrl(partner.image ?? ""))
                .map((parsed) => parsed?.objectKey)
                .filter((objectKey): objectKey is string => Boolean(objectKey))
        ),
    ];
    const partnerProfileImageRecords =
        partnerProfileImageObjectKeys.length > 0
            ? await db
                  .select({
                      objectKey: encryptedMedia.objectKey,
                      ownerId: encryptedMedia.ownerId,
                      aesKey: encryptedMedia.aesKey,
                  })
                  .from(encryptedMedia)
                  .where(
                      inArray(
                          encryptedMedia.objectKey,
                          partnerProfileImageObjectKeys
                      )
                  )
            : [];
    const partnerProfileImageRecordByObjectKey = new Map(
        partnerProfileImageRecords.map((record) => [record.objectKey, record])
    );
    const savedContacts =
        partnerUserIds.length > 0
            ? await db
                  .select({
                      contact_id: contacts.contact_id,
                      owner_user_id: contacts.owner_user_id,
                      linked_user_id: contacts.linked_user_id,
                      linked_user_image: user.image,
                      linked_user_public_key: user.yhlaPublicKey,
                      linked_user_phone_number: user.phoneNumber,
                      contact_ciphertext: contacts.contact_ciphertext,
                      contact_encrypted_aes_key:
                          contacts.contact_encrypted_aes_key,
                      contact_iv: contacts.contact_iv,
                      contact_algorithm: contacts.contact_algorithm,
                      normalized_phone_hash: contacts.normalized_phone_hash,
                      created_at: contacts.created_at,
                      updated_at: contacts.updated_at,
                  })
                  .from(contacts)
                  .leftJoin(user, eq(contacts.linked_user_id, user.id))
                  .where(
                      and(
                          eq(contacts.owner_user_id, sessionUser.id),
                          inArray(contacts.linked_user_id, partnerUserIds)
                      )
                  )
            : [];
    const savedContactsByLinkedUserId = new Map(
        savedContacts.map((contact) => [contact.linked_user_id, contact])
    );
    const ownerContactRows =
        partnerUserIds.length > 0
            ? await db
                  .select({
                      owner_user_id: contacts.owner_user_id,
                  })
                  .from(contacts)
                  .where(
                      and(
                          inArray(contacts.owner_user_id, partnerUserIds),
                          eq(contacts.linked_user_id, sessionUser.id)
                      )
                  )
            : [];
    const ownerContactUserIds = new Set(
        ownerContactRows.map((contact) => contact.owner_user_id)
    );

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
        chats: rows.map((chat) => {
            const lastMessage = chat.last_message_id
                ? lastMessageById.get(chat.last_message_id) ?? null
                : null;
            const lastMessageRecipientUserIds = [
                ...new Set(
                    (
                        chat.last_message_id
                            ? recipientUserIdsByLastMessageId.get(
                                  chat.last_message_id
                              ) ?? []
                            : []
                    ).filter(
                        (recipientUserId) =>
                            recipientUserId &&
                            recipientUserId !== lastMessage?.senderUserId
                    )
                ),
            ];
            const readStatesForChat =
                readStatesByChatId.get(chat.chat_id) ?? [];
            const lastMessageReadByUserIds = lastMessage
                ? lastMessageRecipientUserIds.filter((recipientUserId) =>
                      readStatesForChat.some(
                          (readState) =>
                              readState.userId === recipientUserId &&
                              readState.lastReadAt >= lastMessage.createdAt
                      )
                  )
                : [];
            const lastMessageIsReadByRecipient =
                lastMessageRecipientUserIds.length > 0 &&
                lastMessageRecipientUserIds.every((recipientUserId) =>
                    lastMessageReadByUserIds.includes(recipientUserId)
                );
            const isReactionPreview = chat.last_message_media === "reaction";

            return {
                ...chat,
                last_message_sender_is_me: isReactionPreview
                    ? chat.last_message_sender_nickname === sessionUser.id
                    : lastMessage?.senderUserId === sessionUser.id,
                is_unreaded_chat:
                    (unreadCountsByChatId.get(chat.chat_id) ?? 0) > 0,
                unreaded_messages_length:
                    unreadCountsByChatId.get(chat.chat_id) ?? 0,
                last_message_context: chat.last_message_context,
                last_message_is_read_by_recipient: lastMessageIsReadByRecipient,
                last_message_read_by_user_ids: lastMessageReadByUserIds,
                last_message_recipient_user_ids: lastMessageRecipientUserIds,
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
                          const savedContact = partner?.id
                              ? savedContactsByLinkedUserId.get(partner.id) ?? null
                              : null;
                          const partnerHasSessionUserAsContact = partner?.id
                              ? ownerContactUserIds.has(partner.id)
                              : false;
                          const lastSeenVisibility =
                              (partner?.whoCanSeeLastSeen as
                                  | "all"
                                  | "contacts"
                                  | "nobody"
                                  | undefined) ?? null;
                          const canShowLastSeen = canViewLastSeen(
                              lastSeenVisibility,
                              partnerHasSessionUserAsContact
                          );
                          const profilePictureVisibility =
                              (partner?.whoCanSeeProfilePicture as
                                  | "all"
                                  | "contacts"
                                  | "nobody"
                                  | undefined) ?? null;
                          const canShowProfilePicture = canViewProfilePicture(
                              profilePictureVisibility,
                              partnerHasSessionUserAsContact
                          );
                          const aboutVisibility =
                              (partner?.whoCanSeeAbout as
                                  | "all"
                                  | "contacts"
                                  | "nobody"
                                  | undefined) ?? null;
                          const canShowAbout = canViewAbout(
                              aboutVisibility,
                              partnerHasSessionUserAsContact
                          );
                          const aboutEncryptedAesKey = canShowAbout
                              ? resolveAboutEncryptedAesKeyForRequester({
                                    storedValue: partner?.aboutEncryptedAesKey,
                                    ownerUserId: partner?.id,
                                    requesterUserId: sessionUser.id,
                                })
                              : null;
                          const hasDecryptableAbout = Boolean(
                              partner?.aboutCiphertext &&
                                  partner?.aboutIv &&
                                  aboutEncryptedAesKey
                          );
                          const managedPartnerImage = parseManagedProfileImageUrl(
                              partner?.image ?? ""
                          );
                          const managedPartnerImageRecord = managedPartnerImage
                              ? partnerProfileImageRecordByObjectKey.get(
                                    managedPartnerImage.objectKey
                                ) ?? null
                              : null;
                          const canDecryptPartnerImage = managedPartnerImage
                              ? Boolean(
                                    managedPartnerImageRecord &&
                                        (managedPartnerImageRecord.ownerId ===
                                            sessionUser.id ||
                                            userHasDirectMediaRecipientKey(
                                                managedPartnerImageRecord.aesKey,
                                                sessionUser.id
                                            ))
                                )
                              : Boolean(partner?.image);

                          return {
                              avatar:
                                  canShowProfilePicture &&
                                  partner?.image &&
                                  canDecryptPartnerImage
                                      ? partner.image
                                      : canShowProfilePicture
                                        ? getSafeAvatarUrl(chat.avatar)
                                        : "",
                              recipient_user_id: partner?.id ?? null,
                              recipient_public_key: partner?.publicKey ?? null,
                              contact_phone: partner?.phoneNumber ?? partnerPhone,
                              recipient_last_seen: canShowLastSeen
                                  ? partner?.lastSeen ?? null
                                  : null,
                              recipient_who_can_see_last_seen:
                                  lastSeenVisibility,
                              recipient_last_seen_visible: canShowLastSeen,
                              recipient_who_can_see_status:
                                  (partner?.whoCanSeeStatus as
                                      | "all"
                                      | "contacts"
                                      | "nobody"
                                      | undefined) ?? null,
                              recipient_who_can_see_profile_picture:
                                  profilePictureVisibility,
                              recipient_profile_picture_visible:
                                  canShowProfilePicture,
                              recipient_about_ciphertext: hasDecryptableAbout
                                  ? partner?.aboutCiphertext ?? null
                                  : null,
                              recipient_about_encrypted_aes_key:
                                  hasDecryptableAbout
                                      ? aboutEncryptedAesKey
                                      : null,
                              recipient_about_iv: hasDecryptableAbout
                                  ? partner?.aboutIv ?? null
                                  : null,
                              recipient_who_can_see_about:
                                  aboutVisibility,
                              recipient_about_visible:
                                  canShowAbout,
                              stored_contact: savedContact,
                          };
                      })()
                    : {}),
                chat_recipient_keys: keysByChatId.get(chat.chat_id) ?? null,
            };
        }),
    });
}

export async function PATCH(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
        chatId?: string;
        isMuted?: boolean;
    };
    const chatId = body.chatId?.trim();

    if (!chatId || typeof body.isMuted !== "boolean") {
        return Response.json(
            { error: "Missing chatId or isMuted." },
            { status: 400 }
        );
    }

    const sessionUser = session.user as unknown as UserWithPhone;
    const targetChat = await db.query.chats.findFirst({
        where: eq(chats.chat_id, chatId),
    });

    if (!targetChat) {
        return Response.json({ error: "Chat not found." }, { status: 404 });
    }

    const canUpdate = await canUserAccessChat({
        chatId,
        userId: sessionUser.id,
        phoneNumber: sessionUser.phoneNumber ?? null,
    });

    if (!canUpdate) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
        .update(chats)
        .set({
            is_muted_chat_notifications: body.isMuted,
            updated_at: targetChat.updated_at,
        })
        .where(eq(chats.chat_id, chatId));

    return Response.json({
        success: true,
        chatId,
        isMuted: body.isMuted,
    });
}

function resolveAboutEncryptedAesKeyForRequester({
    storedValue,
    ownerUserId,
    requesterUserId,
}: {
    storedValue?: string | null;
    ownerUserId?: string | null;
    requesterUserId: string;
}) {
    if (!storedValue || !ownerUserId || !requesterUserId) {
        return null;
    }

    const parsedKeyMap = parseRecipientMediaKeyMap(storedValue);

    if (parsedKeyMap) {
        return parsedKeyMap.keys[requesterUserId] ?? null;
    }

    return ownerUserId === requesterUserId ? storedValue : null;
}

async function canUserAccessChat({
    chatId,
    userId,
    phoneNumber,
}: {
    chatId: string;
    userId: string;
    phoneNumber: string | null;
}) {
    if (phoneNumber && chatId.includes(phoneNumber)) {
        return true;
    }

    const [sentMessage, chatRecipientKey, receivedMessage] = await Promise.all([
        db
            .select({ messageId: message.message_id })
            .from(message)
            .where(
                and(
                    eq(message.chat_room_id, chatId),
                    eq(message.sender_user_id, userId)
                )
            )
            .limit(1),
        db
            .select({ chatId: chatRecipientKeys.chat_id })
            .from(chatRecipientKeys)
            .where(
                and(
                    eq(chatRecipientKeys.chat_id, chatId),
                    eq(chatRecipientKeys.recipient_user_id, userId)
                )
            )
            .limit(1),
        db
            .select({ messageId: message.message_id })
            .from(message)
            .innerJoin(
                messageRecipientKeys,
                eq(messageRecipientKeys.message_id, message.message_id)
            )
            .where(
                and(
                    eq(message.chat_room_id, chatId),
                    eq(messageRecipientKeys.recipient_user_id, userId)
                )
            )
            .limit(1),
    ]);

    return (
        sentMessage.length > 0 ||
        chatRecipientKey.length > 0 ||
        receivedMessage.length > 0
    );
}
