"use client";

import { useEffect, useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import {
    findContactByUserId,
    getContactDisplayName,
    resolveDirectChatContact,
} from "@/lib/contact-display";
import {
    getChatDisplayName,
    resolveDirectChatPartner,
} from "@/lib/chat-utils";
import { getCachedMessageMedia } from "@/lib/message-media-cache";
import { fetchAndDecryptMessageMedia } from "@/lib/message-media-upload";
import { parseManagedMessageMediaUrl } from "@/lib/message-media-url";
import {
    canViewAbout,
    canViewProfilePicture,
} from "@/lib/profile-picture-privacy";
import { isManagedProfileImageUrl } from "@/lib/profile-image-url";
import { useDecryptedContacts } from "@/hooks/use-decrypted-contacts";
import { useDecryptedAboutText } from "@/hooks/use-decrypted-about-text";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useDetailedSidebarStore } from "@/store/use-detailed-sidebar-store";
import DetailedLargeSidebarHeader from "./detailed-large-sidebar-header";
import type { Message } from "@/types/messages.type";
import { DetailedSidebarMediaItem } from "./detailed-sidebar-item-media";
import DetailedLargeSidebarContent from "./detailed-large-sidebar-content";

const preloadingMediaObjectKeys = new Set<string>();
const EMPTY_MESSAGES: Message[] = [];

function isVisualMediaMessage(message: Message) {
    return (
        (message.attached_media === "photo" ||
            message.attached_media === "video") &&
        Boolean(message.media_url || message.media_preview_url)
    );
}

export default function DetailedLargeSidebar() {
    const { data: session } = authClient.useSession();
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const target = useDetailedSidebarStore((state) => state.target);
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const chats = useActiveChatStore((state) => state.chats);
    const messagesByChatId = useActiveChatStore(
        (state) => state.messagesByChatId
    );
    const { contacts } = useDecryptedContacts();

    const currentPhone =
        (session?.user as { phoneNumber?: string | null } | undefined)
            ?.phoneNumber ?? null;
    const currentUserId = session?.user.id ?? null;
    const activeChatId = target?.chatId ?? selectedChatId;
    const activeChat =
        chats.find((chat) => chat.chat_id === activeChatId) ?? null;
    const messages = activeChatId
        ? messagesByChatId[activeChatId] ?? EMPTY_MESSAGES
        : EMPTY_MESSAGES;
    const directContact = activeChat
        ? resolveDirectChatContact(activeChat, contacts, currentPhone)
        : null;
    const targetContact =
        target?.type === "user"
            ? findContactByUserId(contacts, target.userId)
            : directContact;
    const profileChat =
        target?.type === "user"
            ? chats.find(
                  (chat) =>
                      chat.chat_type === "single" &&
                      chat.recipient_user_id === target.userId
              ) ?? null
            : activeChat;
    const profileChatContact = profileChat
        ? resolveDirectChatContact(profileChat, contacts, currentPhone)
        : null;

    const mediaItems = useMemo<DetailedSidebarMediaItem[]>(
        () =>
            messages
                .filter(isVisualMediaMessage)
                .sort(
                    (left, right) =>
                        right.created_at.getTime() - left.created_at.getTime()
                )
                .map((message) => ({
                    id: message.message_id,
                    type: message.attached_media === "video" ? "video" : "photo",
                    mediaUrl: message.media_url,
                    previewUrl: message.media_preview_url ?? null,
                    createdAt: message.created_at,
                    senderUserId: message.sender_user_id,
                    senderDisplayName: (() => {
                        const senderContact = findContactByUserId(
                            contacts,
                            message.sender_user_id
                        );

                        return senderContact
                            ? getContactDisplayName(senderContact)
                            : message.sender_user_id;
                    })(),
                })),
        [contacts, messages]
    );

    const mediaCacheSignature = useMemo(
        () =>
            mediaItems
                .map((item) => item.mediaUrl ?? item.previewUrl ?? "")
                .join("|"),
        [mediaItems]
    );

    useEffect(() => {
        let isCancelled = false;

        const preloadLoadedMedia = async () => {
            for (const item of mediaItems) {
                const parsedMedia = parseManagedMessageMediaUrl(item.mediaUrl);

                if (
                    !parsedMedia ||
                    isCancelled ||
                    preloadingMediaObjectKeys.has(parsedMedia.objectKey)
                ) {
                    continue;
                }

                const cachedBlob = await getCachedMessageMedia(
                    parsedMedia.objectKey
                );
                if (cachedBlob || isCancelled) {
                    continue;
                }

                preloadingMediaObjectKeys.add(parsedMedia.objectKey);
                try {
                    await fetchAndDecryptMessageMedia(parsedMedia.objectKey);
                } catch {
                    // Individual media failures should not block the details panel.
                } finally {
                    preloadingMediaObjectKeys.delete(parsedMedia.objectKey);
                }
            }
        };

        void preloadLoadedMedia();

        return () => {
            isCancelled = true;
        };
    }, [mediaCacheSignature, mediaItems]);

    const contactName =
        target?.type === "user"
            ? targetContact
                ? getContactDisplayName(targetContact)
                : target.userId
            : activeChat?.chat_type === "single" && targetContact
              ? getContactDisplayName(targetContact)
              : activeChat
                ? getChatDisplayName(activeChat, currentPhone)
                : null;
    const contactNumber =
        targetContact?.contact_number ??
        (target?.type !== "user" && activeChat?.chat_type === "single"
            ? activeChat.contact_phone ??
              resolveDirectChatPartner(activeChat.chat_id, currentPhone)
            : null);
    const canShowChatAvatar =
        profileChat?.chat_type === "single" &&
        (profileChat.recipient_profile_picture_visible ??
            canViewProfilePicture(
                profileChat.recipient_who_can_see_profile_picture,
                Boolean(profileChatContact)
            ));
    const canShowChatAbout =
        profileChat?.chat_type === "single" &&
        (profileChat.recipient_about_visible ??
            canViewAbout(
                profileChat.recipient_who_can_see_about,
                Boolean(profileChatContact)
            ));
    const { aboutText } = useDecryptedAboutText({
        ciphertext: profileChat?.recipient_about_ciphertext,
        encryptedAesKey: profileChat?.recipient_about_encrypted_aes_key,
        iv: profileChat?.recipient_about_iv,
        enabled: canShowChatAbout,
    });
    const directContactAvatar =
        profileChatContact?.contact_avatar &&
        !isManagedProfileImageUrl(profileChatContact.contact_avatar)
            ? profileChatContact.contact_avatar
            : "";
    const avatar =
        profileChat?.chat_type === "single"
            ? canShowChatAvatar
                ? profileChat.avatar || directContactAvatar
                : ""
            : target?.type === "user"
              ? targetContact?.contact_avatar ?? ""
              : activeChat?.avatar ?? "";

    return (
        <div className="md:flex hidden flex-col w-full h-full bg-white dark:bg-[#161717] relative overflow-hidden">
            <div
                className={`flex flex-col space-y-4 h-screen max-h-screen min-h-screen w-full ${
                    isRTL ? "border-r" : "border-l"
                } dark:border-neutral-700 border-neutral-300 p-4 overflow-y-auto`}
            >
                <DetailedLargeSidebarHeader />
                <DetailedLargeSidebarContent
                    chatId={activeChat?.chat_id ?? null}
                    chatType={activeChat?.chat_type ?? null}
                    avatar={avatar}
                    contactName={contactName}
                    contactNumber={contactNumber}
                    biography={aboutText ?? targetContact?.contact_bio ?? null}
                    mediaCount={mediaItems.length}
                    mediaItems={mediaItems.slice(0, 4)}
                    muteNotification={
                        activeChat?.is_muted_chat_notifications ?? false
                    }
                    isBlocked={activeChat?.is_blocked_chat ?? false}
                    groupMembers={activeChat?.group_members ?? null}
                    currentUserId={currentUserId}
                    contacts={contacts}
                />
            </div>
        </div>
    );
}
