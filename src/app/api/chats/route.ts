import { auth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import db from "@/db";
import {
    getUnreadCountsByChatId,
    markConversationRead,
} from "@/lib/chat-read-state";
import { isManagedProfileImageUrl } from "@/lib/profile-image-url";
import {
    chatRecipientKeys,
    chatReadStates,
    chatUserSettings,
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
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";
import {
    canViewAbout,
    canViewLastSeen,
    canViewProfilePicture,
} from "@/lib/profile-picture-privacy";
import { parseManagedProfileImageUrl } from "@/lib/profile-image-url";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import type { ChatGroupMember, ChatItemType } from "@/types/chats.type";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKey,
    RecipientEncryptedAesKeyInput,
} from "@/types/crypto";

interface UserWithPhone {
    id: string;
    name?: string | null;
    phoneNumber?: string | null;
}

type RealtimeBindings = {
    USER_PRESENCE_DO?: DurableObjectNamespace;
    CHAT_ROOM_DO?: DurableObjectNamespace;
};

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
    const groupMembershipChatIds = new Set(
        chatKeyRows.map((row) => row.chatId)
    );
    const allRows = await db
        .select()
        .from(chats)
        .where(inArray(chats.chat_id, chatIds))
        .orderBy(desc(chats.updated_at));
    const rows = allRows.filter(
        (chat) =>
            chat.chat_type !== "group" ||
            groupMembershipChatIds.has(chat.chat_id)
    );

    if (rows.length === 0) {
        return Response.json({ chats: [] });
    }

    const userSettingRows = await db
        .select()
        .from(chatUserSettings)
        .where(
            and(
                eq(chatUserSettings.user_id, sessionUser.id),
                inArray(
                    chatUserSettings.chat_id,
                    rows.map((row) => row.chat_id)
                )
            )
        );
    const userSettingsByChatId = new Map(
        userSettingRows.map((setting) => [setting.chat_id, setting])
    );

    const groupChatIds = rows
        .filter((chat) => chat.chat_type === "group")
        .map((chat) => chat.chat_id);
    const groupMemberRows =
        groupChatIds.length > 0
            ? await db
                  .select({
                      chatId: chatRecipientKeys.chat_id,
                      userId: user.id,
                      phoneNumber: user.phoneNumber,
                      publicKey: user.yhlaPublicKey,
                      name: user.name,
                      isAdmin: chatRecipientKeys.is_admin,
                  })
                  .from(chatRecipientKeys)
                  .innerJoin(
                      user,
                      eq(chatRecipientKeys.recipient_user_id, user.id)
                  )
                  .where(inArray(chatRecipientKeys.chat_id, groupChatIds))
            : [];
    const groupMembersByChatId = new Map<string, ChatGroupMember[]>();
    for (const member of groupMemberRows) {
        const existingMembers = groupMembersByChatId.get(member.chatId) ?? [];
        existingMembers.push({
            user_id: member.userId,
            phone_number: member.phoneNumber,
            public_key: member.publicKey,
            name: member.name,
            is_admin: member.isAdmin,
        });
        groupMembersByChatId.set(member.chatId, existingMembers);
    }
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
        chats: rows
            .filter(
                (chat) =>
                    !(userSettingsByChatId.get(chat.chat_id)?.is_deleted_chat)
            )
            .map((chat) => {
            const userSettings = userSettingsByChatId.get(chat.chat_id);
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
                group_members:
                    chat.chat_type === "group"
                        ? groupMembersByChatId.get(chat.chat_id) ?? []
                        : null,
                last_message_sender_is_me: isReactionPreview
                    ? chat.last_message_sender_nickname === sessionUser.id
                    : lastMessage?.senderUserId === sessionUser.id,
                is_unreaded_chat:
                    (unreadCountsByChatId.get(chat.chat_id) ?? 0) > 0,
                unreaded_messages_length:
                    unreadCountsByChatId.get(chat.chat_id) ?? 0,
                is_archived_chat: userSettings?.is_archived_chat ?? false,
                is_muted_chat_notifications:
                    userSettings?.is_muted_chat_notifications ?? false,
                is_pinned_chat: userSettings?.is_pinned_chat ?? false,
                is_favourite_chat:
                    userSettings?.is_favourite_chat ?? false,
                is_blocked_chat: userSettings?.is_blocked_chat ?? false,
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

export async function POST(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as unknown as UserWithPhone;
    const body = (await request.json()) as {
        name?: string;
        avatar?: string | null;
        memberUserIds?: string[];
        encryptedChatPreview?: EncryptedContentEnvelope | null;
        chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
    };
    const groupName = body.name?.trim() ?? "";
    const avatar = body.avatar?.trim() ?? "";
    const requestedMemberIds = [
        ...new Set(
            (body.memberUserIds ?? [])
                .map((memberId) => memberId.trim())
                .filter(
                    (memberId) => memberId && memberId !== sessionUser.id
                )
        ),
    ];

    if (!groupName) {
        return Response.json(
            { error: "Group name is required." },
            { status: 400 }
        );
    }

    if (requestedMemberIds.length === 0) {
        return Response.json(
            { error: "Select at least one group member." },
            { status: 400 }
        );
    }

    if (
        avatar &&
        !isManagedProfileImageUrl(avatar) &&
        !parseManagedMessageMediaUrl(avatar)
    ) {
        return Response.json(
            { error: "Group avatar must use a managed encrypted media route." },
            { status: 400 }
        );
    }

    if (
        !body.encryptedChatPreview?.ciphertext ||
        !body.encryptedChatPreview.iv ||
        !body.chatPreviewRecipientKeys?.length
    ) {
        return Response.json(
            { error: "Encrypted group preview and recipient keys are required." },
            { status: 400 }
        );
    }

    const contactRows = await db
        .select({
            linkedUserId: contacts.linked_user_id,
        })
        .from(contacts)
        .where(
            and(
                eq(contacts.owner_user_id, sessionUser.id),
                inArray(contacts.linked_user_id, requestedMemberIds)
            )
        );
    const allowedMemberIds = new Set(
        contactRows.map((contact) => contact.linkedUserId)
    );
    const blockedMemberId = requestedMemberIds.find(
        (memberId) => !allowedMemberIds.has(memberId)
    );

    if (blockedMemberId) {
        return Response.json(
            { error: "Every group member must be one of your saved contacts." },
            { status: 403 }
        );
    }

    const creatorUserId = sessionUser.id;
    const participantIds = [creatorUserId, ...requestedMemberIds];
    const participantRows = await db
        .select({
            userId: user.id,
            phoneNumber: user.phoneNumber,
            publicKey: user.yhlaPublicKey,
            name: user.name,
        })
        .from(user)
        .where(inArray(user.id, participantIds));
    const participantById = new Map(
        participantRows.map((participant) => [participant.userId, participant])
    );
    const missingParticipantId = participantIds.find(
        (participantId) => !participantById.has(participantId)
    );

    if (missingParticipantId) {
        return Response.json(
            { error: "One of the selected members no longer exists." },
            { status: 400 }
        );
    }

    const missingKeyParticipant = participantRows.find(
        (participant) => !participant.publicKey
    );
    if (missingKeyParticipant) {
        return Response.json(
            { error: "Every group member must have encryption keys set up." },
            { status: 400 }
        );
    }

    const normalizedPreviewKeys = normalizeRecipientKeys(
        body.chatPreviewRecipientKeys
    );
    const participantIdSet = new Set(participantIds);
    const unknownKey = normalizedPreviewKeys.find(
        (key) => !participantIdSet.has(key.recipient_user_id)
    );
    const missingPreviewKey = participantIds.find(
        (participantId) =>
            !normalizedPreviewKeys.some(
                (key) => key.recipient_user_id === participantId
            )
    );

    if (unknownKey || missingPreviewKey) {
        return Response.json(
            { error: "Group encryption keys must match the selected members." },
            { status: 400 }
        );
    }

    const now = new Date();
    const chatId = `group:${crypto.randomUUID()}`;

    await db.insert(chats).values({
        chat_id: chatId,
        chat_type: "group",
        display_name: groupName,
        avatar,
        last_message_id: null,
        encrypted_preview_ciphertext: body.encryptedChatPreview.ciphertext,
        encrypted_preview_iv: body.encryptedChatPreview.iv,
        encrypted_preview_algorithm: body.encryptedChatPreview.algorithm,
        last_message_context: "",
        last_message_media: null,
        last_message_sender_is_me: false,
        last_message_sender_nickname: sessionUser.id,
        is_unreaded_chat: false,
        unreaded_messages_length: 0,
        is_archived_chat: false,
        is_muted_chat_notifications: false,
        is_pinned_chat: false,
        is_favourite_chat: false,
        is_blocked_chat: false,
        created_at: now,
        updated_at: now,
    });

    for (const key of normalizedPreviewKeys) {
        await db.insert(chatRecipientKeys).values({
            id: crypto.randomUUID(),
            chat_id: chatId,
            recipient_user_id: key.recipient_user_id,
            encrypted_aes_key: key.encrypted_aes_key,
            is_admin: key.recipient_user_id === creatorUserId,
            algorithm: key.algorithm,
            created_at: now,
            updated_at: now,
        });
    }

    for (const participantId of participantIds) {
        await db
            .insert(chatReadStates)
            .values({
                id: crypto.randomUUID(),
                chat_id: chatId,
                user_id: participantId,
                last_read_at: now,
                created_at: now,
                updated_at: now,
            })
            .onConflictDoUpdate({
                target: [
                    chatReadStates.chat_id,
                    chatReadStates.user_id,
                ],
                set: {
                    last_read_at: now,
                    updated_at: now,
                },
            });
    }

    const groupMembers: ChatGroupMember[] = participantIds
        .map((participantId) => participantById.get(participantId))
        .filter(
            (participant): participant is (typeof participantRows)[number] =>
                Boolean(participant)
        )
        .map((participant) => ({
            user_id: participant.userId,
            phone_number: participant.phoneNumber,
            public_key: participant.publicKey,
            name: participant.name,
            is_admin: participant.userId === creatorUserId,
        }));
    const chat: ChatItemType = {
        chat_id: chatId,
        chat_type: "group",
        display_name: groupName,
        group_members: groupMembers,
        avatar,
        last_message_id: null,
        encrypted_preview_ciphertext: body.encryptedChatPreview.ciphertext,
        encrypted_preview_iv: body.encryptedChatPreview.iv,
        encrypted_preview_algorithm: body.encryptedChatPreview.algorithm,
        chat_recipient_keys: normalizedPreviewKeys,
        last_message_context: "",
        last_message_media: null,
        last_message_sender_is_me: false,
        last_message_sender_nickname: sessionUser.id,
        last_message_is_read_by_recipient: null,
        last_message_read_by_user_ids: [],
        last_message_recipient_user_ids: requestedMemberIds,
        is_unreaded_chat: false,
        unreaded_messages_length: 0,
        is_archived_chat: false,
        is_muted_chat_notifications: false,
        is_pinned_chat: false,
        is_favourite_chat: false,
        is_blocked_chat: false,
        created_at: now,
        updated_at: now,
    };

    await broadcastGroupCreated({
        chat,
        creatorUserId: sessionUser.id,
        participantIds,
    });

    return Response.json({ chat }, { status: 201 });
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
        isArchived?: boolean;
        isPinned?: boolean;
        isFavourite?: boolean;
        isBlocked?: boolean;
        isDeleted?: boolean;
        markRead?: boolean;
    };
    const chatId = body.chatId?.trim();

    if (!chatId) {
        return Response.json(
            { error: "Missing chatId." },
            { status: 400 }
        );
    }

    const preferenceUpdates: Partial<typeof chatUserSettings.$inferInsert> = {};
    if (typeof body.isMuted === "boolean") {
        preferenceUpdates.is_muted_chat_notifications = body.isMuted;
    }
    if (typeof body.isArchived === "boolean") {
        preferenceUpdates.is_archived_chat = body.isArchived;
    }
    if (typeof body.isPinned === "boolean") {
        preferenceUpdates.is_pinned_chat = body.isPinned;
    }
    if (typeof body.isFavourite === "boolean") {
        preferenceUpdates.is_favourite_chat = body.isFavourite;
    }
    if (typeof body.isBlocked === "boolean") {
        preferenceUpdates.is_blocked_chat = body.isBlocked;
    }
    if (typeof body.isDeleted === "boolean") {
        preferenceUpdates.is_deleted_chat = body.isDeleted;
    }

    const shouldMarkRead = body.markRead === true;
    if (Object.keys(preferenceUpdates).length === 0 && !shouldMarkRead) {
        return Response.json(
            { error: "No chat action was provided." },
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

    if (Object.keys(preferenceUpdates).length > 0) {
        const now = new Date();

        await db
            .insert(chatUserSettings)
            .values({
                id: crypto.randomUUID(),
                chat_id: chatId,
                user_id: sessionUser.id,
                ...preferenceUpdates,
                created_at: now,
                updated_at: now,
            })
            .onConflictDoUpdate({
                target: [
                    chatUserSettings.chat_id,
                    chatUserSettings.user_id,
                ],
                set: {
                    ...preferenceUpdates,
                    updated_at: now,
                },
            });
    }

    if (shouldMarkRead) {
        const readAt = new Date();

        await markConversationRead({
            chatId,
            userId: sessionUser.id,
            readAt,
        });
        await broadcastMarkRead({
            chatId,
            userId: sessionUser.id,
            readAt,
        });
    }

    return Response.json({
        success: true,
        chatId,
        ...preferenceUpdates,
        ...(shouldMarkRead ? { markRead: true } : {}),
    });
}

function normalizeRecipientKeys(
    keys: RecipientEncryptedAesKeyInput[] | null | undefined
): RecipientEncryptedAesKey[] {
    return (keys ?? [])
        .filter((key) => key.recipientUserId && key.encryptedAesKey)
        .map((key) => ({
            recipient_user_id: key.recipientUserId,
            encrypted_aes_key: key.encryptedAesKey,
            algorithm: key.algorithm ?? "aes-256-gcm+rsa-oaep-sha256",
        }));
}

async function broadcastGroupCreated({
    chat,
    creatorUserId,
    participantIds,
}: {
    chat: ChatItemType;
    creatorUserId: string;
    participantIds: string[];
}) {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bindings = env as unknown as RealtimeBindings;
        const presenceNamespace = bindings.USER_PRESENCE_DO;

        if (!presenceNamespace) {
            return;
        }

        await Promise.all(
            [...new Set(participantIds)]
                .filter(
                    (participantId) =>
                        participantId && participantId !== creatorUserId
                )
                .map(async (participantId) => {
                    const userDO = presenceNamespace.get(
                        presenceNamespace.idFromName(participantId)
                    );

                    await userDO.fetch("https://do/event", {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                        },
                        body: JSON.stringify({
                            type: "GROUP_CREATED",
                            chat,
                        }),
                    });
                })
        );
    } catch {
        // Realtime fanout is best-effort; the group is already persisted.
    }
}

async function broadcastMarkRead({
    chatId,
    userId,
    readAt,
}: {
    chatId: string;
    userId: string;
    readAt: Date;
}) {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bindings = env as unknown as RealtimeBindings;
        const roomNamespace = bindings.CHAT_ROOM_DO;

        if (!roomNamespace) {
            return;
        }

        const roomDO = roomNamespace.get(roomNamespace.idFromName(chatId));
        await roomDO.fetch("https://do/broadcast", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                type: "MARK_READ",
                conversationId: chatId,
                messageId: null,
                userId,
                readAt: readAt.toISOString(),
            }),
        });
    } catch {
        // Realtime fanout is best-effort; the read state is already persisted.
    }
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
