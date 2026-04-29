"use client";

import { generateVideoThumbnailFromUrl } from "@/lib/generate-thumbnail";
import type { Message } from "@/types/messages.type";
import {
    AccessTime,
    DoneAll,
    DownloadRounded,
    ErrorOutline,
    ImageOutlined,
    Mic,
    PauseRounded,
    Person,
    PlayArrowRounded,
    ShortcutOutlined,
    VideocamRounded,
} from "@mui/icons-material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import CircularProgress from "@mui/material/CircularProgress";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Typography from "@mui/material/Typography";
import { LazyLoadImage } from "react-lazy-load-image-component";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { formatFileSize, getFileExtension, getFileSize } from "@/lib/files";
import AudioPlayer, { RHAP_UI } from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import Link from "next/link";
import ChatRoomActionBubble from "./chat-room-action-bubble";
import ChatRoomReactionButton from "./chat-room-reaction-button";
import ChatRoomForwardButton from "./chat-room-forward-button";
import useMediaPreviewStore from "@/store/media-preview-store";
import Avatar from "@mui/material/Avatar";
import PollComponent from "./chat-poll-item";
import { convertToPollWithVotes } from "@/utils/convert-to-poll-with-votes";
import { useDetailedSidebarStore } from "@/store/use-detailed-sidebar-store";
import { useDecryptedMessageMedia } from "@/hooks/use-decrypted-message-media";
import { authClient } from "@/lib/auth-client";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useDecryptedContacts } from "@/hooks/use-decrypted-contacts";
import {
    findContactByUserId,
    getContactDisplayName,
} from "@/lib/contact-display";
import { logMediaDebug } from "@/lib/message-media-debug";

type Props = {
    message: Message;
    isSelectMode: boolean;
    selectedMessages: string[];
    setSelectedMessages: (value: string[]) => void;
    isFirstInGroup?: boolean;
    onRetry?: () => void;
};

export default function ChatRoomMessageBubble({
    message,
    isSelectMode,
    selectedMessages,
    setSelectedMessages,
    isFirstInGroup = true,
    onRetry,
}: Props) {
    const { data: session } = authClient.useSession();
    const { openPreview } = useMediaPreviewStore();
    const { open } = useDetailedSidebarStore();
    const chats = useActiveChatStore((state) => state.chats);
    const { contacts } = useDecryptedContacts();

    const autoDownloadMedia =
        message.attached_media === "photo"
            ? (
                  (session?.user as
                      | { imageMediaAutoDownload?: boolean }
                      | undefined)
                      ?.imageMediaAutoDownload ?? false
              ) || message.sender_user_id === session?.user.id
            : message.attached_media === "video"
              ? (
                    (session?.user as
                        | { videoMediaAutoDownload?: boolean }
                        | undefined)
                        ?.videoMediaAutoDownload ?? false
                ) || message.sender_user_id === session?.user.id
              : true;

    const {
        decryptedUrl: decryptedMediaUrl,
        displayUrl: displayMediaUrl,
        mimeType: decryptedMediaMimeType,
        loading: decryptedMediaLoading,
        download: downloadMedia,
    } = useDecryptedMessageMedia({
        mediaUrl: message.media_url,
        previewUrl: message.media_preview_url ?? null,
        autoDownload: autoDownloadMedia,
    });

    const [thumbnail, setThumbnail] = useState("");
    const [isListEnter, setIsListEnter] = useState(false);
    const [fileSize, setFileSize] = useState(0);
    const [isBubbleEnter, setIsBubbleEnter] = useState(false);

    const mediaTypes = ["photo", "video"] as const;
    const mediaPrev = mediaTypes.includes(
        message.attached_media as (typeof mediaTypes)[number]
    );

    const handleToggle = (value: string) => () => {
        const currentIndex = selectedMessages.indexOf(value);
        const newChecked = [...selectedMessages];

        if (currentIndex === -1) {
            newChecked.push(value);
        } else {
            newChecked.splice(currentIndex, 1);
        }

        setSelectedMessages(newChecked);
    };

    useEffect(() => {
        let isActive = true;
        let generatedThumbnailUrl: string | null = null;

        const prepareVideoThumbnail = async () => {
            try {
                if (message.attached_media !== "video") {
                    setThumbnail("");
                    return;
                }

                if (!decryptedMediaUrl) {
                    setThumbnail(message.media_preview_url ?? "");
                    return;
                }

                const thumbnailBlob =
                    await generateVideoThumbnailFromUrl(decryptedMediaUrl);
                generatedThumbnailUrl = URL.createObjectURL(thumbnailBlob);

                if (isActive) {
                    setThumbnail(generatedThumbnailUrl);
                }
            } catch {
                if (isActive) {
                    setThumbnail(message.media_preview_url ?? "");
                }
            }
        };

        void prepareVideoThumbnail();

        return () => {
            isActive = false;
            if (generatedThumbnailUrl) {
                URL.revokeObjectURL(generatedThumbnailUrl);
            }
        };
    }, [decryptedMediaUrl, message.attached_media, message.media_preview_url]);

    useEffect(() => {
        const prepareFileSize = async () => {
            try {
                if (message.attached_media !== "file") {
                    return;
                }

                if (message.media_size_bytes) {
                    setFileSize(message.media_size_bytes);
                    return;
                }

                if (message.client_local_media_size) {
                    setFileSize(message.client_local_media_size);
                    return;
                }

                if (message.media_url) {
                    const size = await getFileSize(message.media_url);
                    setFileSize(size || 0);
                }
            } catch {
                setFileSize(0);
            }
        };

        void prepareFileSize();
    }, [
        message.attached_media,
        message.client_local_media_size,
        message.media_size_bytes,
        message.media_url,
    ]);

    const isSender = message.sender_user_id === session?.user.id;
    const activeChat =
        chats.find((chat) => chat.chat_id === message.chat_room_id) ?? null;
    const isGroupChat = activeChat?.chat_type === "group";
    const senderContact = findContactByUserId(contacts, message.sender_user_id);
    const senderDisplayName = senderContact
        ? getContactDisplayName(senderContact)
        : message.sender_user_id;
    const senderAvatar = senderContact?.contact_avatar ?? "";
    const replySenderContact = findContactByUserId(
        contacts,
        message.reply_message?.original_sender_user_id
    );
    const replySenderDisplayName = replySenderContact
        ? getContactDisplayName(replySenderContact)
        : message.reply_message?.original_sender_user_id;

    const TAIL_WIDTH = 8;

    const getHue = (userId: string | undefined): number => {
        if (!userId) {
            return 0;
        }
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = (hash << 5) - hash + userId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 360;
    };

    const getReplyLabel = () => {
        const reply = message.reply_message;
        if (!reply) return null;
        if (reply.original_message_text) return reply.original_message_text;
        if (reply.original_attached_media) {
            const map: Record<string, string> = {
                photo: "Photo",
                video: "Video",
                voice: "Voice message",
                file: "Document",
                contact: "Contact",
                location: "Location",
            };
            return map[reply.original_attached_media] || "Attachment";
        }
        return "Message";
    };

    const fileTypeLabel =
        message.client_local_media_mime_type?.split("/").pop()?.toUpperCase() ||
        decryptedMediaMimeType?.split("/").pop()?.toUpperCase() ||
        getFileExtension(message.media_url || "");
    const mediaSizeLabel = formatFileSize(
        message.media_size_bytes ?? message.client_local_media_size ?? fileSize
    );
    const isAttachmentPending =
        message.client_status === "sending" &&
        ["photo", "video", "voice", "file"].includes(
            message.attached_media ?? ""
        );
    const isAttachmentDecrypting =
        Boolean(message.attached_media && message.attached_media !== "contact") &&
        decryptedMediaLoading;
    const shouldShowManualDownload =
        mediaPrev &&
        !decryptedMediaUrl &&
        !isAttachmentPending &&
        !isAttachmentDecrypting &&
        !autoDownloadMedia;
    const shouldBlurPreview =
        mediaPrev && !decryptedMediaUrl && Boolean(message.media_preview_url);
    const mediaDisplaySource =
        message.attached_media === "photo" ? displayMediaUrl : thumbnail;

    useEffect(() => {
        if (!mediaPrev) {
            return;
        }

        logMediaDebug("client.bubble.media-state", {
            messageId: message.message_id,
            attachedMedia: message.attached_media,
            isSender,
            mediaUrl: message.media_url,
            mediaPreviewUrl: message.media_preview_url ?? null,
            mediaDisplaySource: mediaDisplaySource ?? null,
            decryptedMediaUrl: decryptedMediaUrl ?? null,
            thumbnail: thumbnail || null,
            autoDownloadMedia,
            isAttachmentPending,
            isAttachmentDecrypting,
            shouldShowManualDownload,
            shouldBlurPreview,
        });
    }, [
        autoDownloadMedia,
        decryptedMediaUrl,
        isAttachmentDecrypting,
        isAttachmentPending,
        isSender,
        mediaDisplaySource,
        mediaPrev,
        message.attached_media,
        message.media_preview_url,
        message.media_url,
        message.message_id,
        shouldBlurPreview,
        shouldShowManualDownload,
        thumbnail,
    ]);

    return (
        <ListItem disablePadding>
            <ListItemButton
                dir="ltr"
                onClick={isSelectMode ? handleToggle(message.message_id) : () => {}}
                dense={false}
                disableRipple={!isSelectMode}
                disableTouchRipple={!isSelectMode}
                onMouseEnter={() => setIsListEnter(true)}
                onMouseLeave={() => setIsListEnter(false)}
                sx={{
                    cursor: isSelectMode ? "pointer" : "default",
                    ...(!isSelectMode && {
                        "&:hover": { backgroundColor: "transparent" },
                    }),
                    paddingTop: isFirstInGroup ? undefined : "2px",
                    paddingBottom: isFirstInGroup ? undefined : "2px",
                    marginBottom: message.message_raction?.reaction_emoji ? 2 : 0,
                }}
            >
                <div
                    className={`flex w-full flex-row items-center md:mx-auto md:max-w-7xl ${
                        !isSender ? "gap-x-3" : ""
                    } ${isSender && isSelectMode ? "justify-end" : ""}`}
                >
                    {isSelectMode && (
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedMessages.includes(message.message_id)}
                                tabIndex={-1}
                                disableRipple
                                sx={{ "&.Mui-checked": { color: "#25D366" } }}
                            />
                        </ListItemIcon>
                    )}
                    {!isSelectMode && isSender && (
                        <div className="ml-auto mr-1 flex flex-row items-center gap-x-1">
                            <ChatRoomForwardButton />
                            {isListEnter && <ChatRoomReactionButton />}
                        </div>
                    )}
                    <div className="flex flex-row items-start">
                        {!isSender && isGroupChat && (
                            <div
                                style={{
                                    width: 34,
                                    flexShrink: 0,
                                    alignSelf: "flex-start",
                                    marginRight: 4,
                                }}
                            >
                                {isFirstInGroup ? (
                                    <Avatar
                                        sx={(theme) => {
                                            const hue = getHue(message.sender_user_id);
                                            const mode = theme.palette.mode;

                                            if (mode === "dark") {
                                                return {
                                                    width: 34,
                                                    height: 34,
                                                    backgroundColor: `hsl(${hue}, 40%, 15%)`,
                                                    color: `hsl(${hue}, 80%, 65%)`,
                                                    fontSize: 16,
                                                };
                                            }

                                            return {
                                                width: 34,
                                                height: 34,
                                                backgroundColor: `hsl(${hue}, 70%, 85%)`,
                                                color: `hsl(${hue}, 80%, 30%)`,
                                                fontSize: 16,
                                            };
                                        }}
                                        src={senderAvatar}
                                        alt={senderDisplayName}
                                    >
                                        <Person fontSize="small" />
                                    </Avatar>
                                ) : (
                                    <div style={{ width: 34, height: 34 }} />
                                )}
                            </div>
                        )}
                        {!isSender &&
                            (isFirstInGroup ? (
                                <span
                                    className="text-white dark:text-[#222424]"
                                    aria-hidden="true"
                                    data-icon="tail-in"
                                >
                                    <svg
                                        viewBox="0 0 8 13"
                                        height="13"
                                        width={TAIL_WIDTH}
                                        preserveAspectRatio="xMidYMid meet"
                                        version="1.1"
                                        x="0px"
                                        y="0px"
                                        enableBackground="new 0 0 8 13"
                                    >
                                        <title>tail-in</title>
                                        <path
                                            opacity="0.13"
                                            fill="currentColor"
                                            d="M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M1.533,2.568L8,11.193V0L2.812,0C1.042,0,0.474,1.156,1.533,2.568z"
                                        />
                                    </svg>
                                </span>
                            ) : (
                                <div style={{ width: TAIL_WIDTH, flexShrink: 0 }} />
                            ))}

                        <Card
                            sx={(theme) => ({
                                maxWidth: {
                                    lg: mediaPrev ? 250 : "100%",
                                    xs: mediaPrev ? 200 : "100%",
                                },
                                padding: "3px",
                                borderTopRightRadius: isSender
                                    ? isFirstInGroup
                                        ? 0
                                        : 7
                                    : 7,
                                borderBottomRightRadius: 7,
                                borderBottomLeftRadius: 7,
                                borderTopLeftRadius: isSender
                                    ? 7
                                    : isFirstInGroup
                                      ? 0
                                      : 7,
                                position: "relative",
                                overflow: "visible",
                                boxShadow: "0px 2px 0px rgba(0,0,0,0.09)",
                                backgroundColor: isSender
                                    ? theme.palette.mode === "dark"
                                        ? "#24352A"
                                        : "#DCF8C6"
                                    : theme.palette.mode === "dark"
                                      ? "#222424"
                                      : "#FFFFFF",
                            })}
                            onMouseEnter={() => !isSelectMode && setIsBubbleEnter(true)}
                            onMouseLeave={() => setIsBubbleEnter(false)}
                        >
                            <CardHeader
                                action={
                                    isBubbleEnter &&
                                    !isSelectMode && (
                                        <motion.div
                                            initial={{ x: 16, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: 16, opacity: 0 }}
                                            transition={{
                                                duration: 0.09,
                                                ease: "easeOut",
                                            }}
                                        >
                                            <ChatRoomActionBubble />
                                        </motion.div>
                                    )
                                }
                                sx={{
                                    position: "absolute",
                                    zIndex: 10,
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    paddingY: "6px",
                                    paddingX: "12px",
                                    m: "3px",
                                    borderTopRightRadius: 5,
                                    transition: "ease-in-out",
                                    pointerEvents: "none",
                                }}
                            />
                            {!isSender && isGroupChat && (
                                <Button
                                    variant="text"
                                    onClick={open}
                                    size="small"
                                    className="pl-2 font-semibold! text-xs!"
                                    sx={(theme) => {
                                        const hue = getHue(message.sender_user_id);
                                        const mode = theme.palette.mode;

                                        return {
                                            color:
                                                mode === "dark"
                                                    ? `hsl(${hue}, 80%, 65%)`
                                                    : `hsl(${hue}, 80%, 30%)`,
                                            textTransform: "none",
                                            minWidth: "auto",
                                            padding: 0,
                                            paddingLeft: 1,
                                            "&:hover": {
                                                backgroundColor: "transparent",
                                                textDecoration: "underline",
                                            },
                                        };
                                    }}
                                >
                                    {senderDisplayName}
                                </Button>
                            )}
                            {message.is_forward_message && (
                                <span className="flex flex-row items-center gap-x-2 p-1 text-xs text-gray-300 dark:text-gray-400">
                                    <ShortcutOutlined fontSize="inherit" />
                                    <p className="italic">Forwarded</p>
                                </span>
                            )}
                            {message.reply_message && (
                                <Box
                                    sx={(theme) => {
                                        const hue = getHue(
                                            message.reply_message?.original_sender_user_id
                                        );
                                        const accent = `hsl(${hue}, 80%, ${
                                            theme.palette.mode === "dark" ? "60%" : "35%"
                                        })`;
                                        return {
                                            mt: 0.5,
                                            mb: 0.75,
                                            px: 1,
                                            py: 0.5,
                                            borderLeft: `4px solid ${accent}`,
                                            borderRadius: 1.5,
                                            backgroundColor:
                                                theme.palette.mode === "dark"
                                                    ? "rgba(255,255,255,0.04)"
                                                    : "rgba(0,0,0,0.04)",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0.2,
                                        };
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        sx={(theme) => {
                                            const hue = getHue(
                                                message.reply_message?.original_sender_user_id
                                            );
                                            return {
                                                fontWeight: 600,
                                                color: `hsl(${hue}, 80%, ${
                                                    theme.palette.mode === "dark"
                                                        ? "60%"
                                                        : "35%"
                                                })`,
                                            };
                                        }}
                                    >
                                        {replySenderDisplayName}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: "text.secondary",
                                            display: "-webkit-box",
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            WebkitLineClamp: 2,
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {getReplyLabel()}
                                    </Typography>
                                </Box>
                            )}
                            {message.open_graph_data && (
                                <Link
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href={message.open_graph_data.og_url || "/"}
                                    className="mb-1 flex cursor-pointer flex-col items-start justify-start gap-x-3 rounded-lg bg-[#f7f5f3] p-2 text-sm dark:bg-[#1a1b1b]"
                                >
                                    <p className="font-semibold">
                                        {message.open_graph_data.og_title}
                                    </p>
                                    <p className="text-gray-500 dark:text-gray-300">
                                        {message.open_graph_data.og_description}
                                    </p>
                                    <p className="text-xs text-gray-700 dark:text-gray-400">
                                        {message.open_graph_data.og_url}
                                    </p>
                                </Link>
                            )}
                            {message.poll && (
                                <PollComponent
                                    poll={convertToPollWithVotes(message.poll)}
                                    onVote={() => {}}
                                    isSender={isSender}
                                />
                            )}
                            {message.attached_media === "voice" && (
                                <div className="flex flex-row items-center gap-x-1 p-2">
                                    <div className="relative">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f7f5f3] text-gray-300 dark:bg-[#1a1b1b]">
                                            <Person fontSize="large" />
                                        </div>
                                        <Mic
                                            fontSize="small"
                                            className="absolute -bottom-1 -right-1 text-[#25D366]"
                                        />
                                    </div>
                                    <div className="flex min-w-64 max-w-64 flex-row items-center gap-x-2">
                                        <AudioPlayer
                                            src={decryptedMediaUrl || ""}
                                            showJumpControls={false}
                                            customAdditionalControls={[]}
                                            layout="horizontal-reverse"
                                            customControlsSection={[
                                                RHAP_UI.MAIN_CONTROLS,
                                                RHAP_UI.CURRENT_TIME,
                                                RHAP_UI.PROGRESS_BAR,
                                            ]}
                                            customIcons={{
                                                play: (
                                                    <PlayArrowRounded
                                                        sx={(theme) => ({
                                                            color:
                                                                theme.palette.mode === "dark"
                                                                    ? "white"
                                                                    : "black",
                                                            marginBottom: 0.5,
                                                        })}
                                                    />
                                                ),
                                                pause: (
                                                    <PauseRounded
                                                        sx={(theme) => ({
                                                            color:
                                                                theme.palette.mode === "dark"
                                                                    ? "white"
                                                                    : "black",
                                                            marginBottom: 0.5,
                                                        })}
                                                    />
                                                ),
                                            }}
                                            customProgressBarSection={[]}
                                        />
                                    </div>
                                </div>
                            )}
                            {message.attached_media === "file" && (
                                <button
                                    className="mb-1 flex w-full cursor-pointer flex-row items-center gap-x-3 rounded-lg bg-[#f7f5f3] p-4 dark:bg-[#1a1b1b]"
                                    onClick={() => {
                                        if (decryptedMediaUrl) {
                                            window.open(
                                                decryptedMediaUrl,
                                                "_blank",
                                                "noopener,noreferrer"
                                            );
                                        }
                                    }}
                                >
                                    <Image
                                        src="/file.svg"
                                        alt="File"
                                        width={500}
                                        height={500}
                                        className="h-8 w-auto object-contain"
                                    />
                                    <span className="flex flex-col leading-tight text-start">
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                display: "-webkit-box",
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {message.client_local_media_name ||
                                                "Encrypted file"}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ color: "gray" }}
                                        >
                                            {fileTypeLabel} • {mediaSizeLabel}
                                        </Typography>
                                    </span>
                                </button>
                            )}
                            {mediaPrev && (
                                <button
                                    onClick={() => {
                                        if (
                                            message.attached_media === "photo" ||
                                            message.attached_media === "video"
                                        ) {
                                            openPreview(
                                                message.attached_media,
                                                message.media_url || "",
                                                message.sender_user_id,
                                                message.created_at.toLocaleDateString()
                                            );
                                        }
                                    }}
                                    className="relative cursor-pointer overflow-hidden"
                                >
                                    {(isAttachmentDecrypting || isAttachmentPending) && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-black/20">
                                            <CircularProgress
                                                size={26}
                                                sx={{ color: "#ffffff" }}
                                            />
                                        </div>
                                    )}
                                    {shouldShowManualDownload && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-black/30 p-3">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void downloadMedia();
                                                }}
                                                className="flex items-center gap-x-2 rounded-full bg-black/55 px-3 py-2 text-sm text-white backdrop-blur-sm"
                                            >
                                                <DownloadRounded fontSize="small" />
                                                <span>{mediaSizeLabel}</span>
                                            </button>
                                        </div>
                                    )}
                                    {message.attached_media === "video" && (
                                        <div className="absolute bottom-0 left-0 right-0 top-0 z-5 flex h-full w-full items-center justify-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-white">
                                                <PlayArrowRounded fontSize="large" />
                                            </div>
                                            <div className="absolute bottom-2 left-2 flex flex-row items-center gap-x-1 text-xs text-white">
                                                <VideocamRounded fontSize="small" />
                                                <p className="text-gray-200">Video</p>
                                            </div>
                                        </div>
                                    )}
                                    {mediaDisplaySource ? (
                                        <LazyLoadImage
                                            alt={message.message_text_content || ""}
                                            height="auto"
                                            effect="blur"
                                            src={mediaDisplaySource}
                                            width="100%"
                                            wrapperProps={{
                                                style: { transitionDelay: "1s" },
                                            }}
                                            style={{
                                                borderRadius: 4,
                                                overflow: "hidden",
                                                filter: shouldBlurPreview
                                                    ? "blur(12px)"
                                                    : "none",
                                                transform: shouldBlurPreview
                                                    ? "scale(1.04)"
                                                    : "none",
                                                transition:
                                                    "filter 180ms ease, transform 180ms ease",
                                            }}
                                        />
                                    ) : (
                                        <div className="flex min-h-44 w-48 items-center justify-center rounded bg-gradient-to-br from-[#d6d1cb] to-[#bab4ae] text-white dark:from-[#2d3131] dark:to-[#1e2222]">
                                            <div className="flex flex-col items-center gap-y-2 text-center">
                                                {message.attached_media === "video" ? (
                                                    <VideocamRounded fontSize="large" />
                                                ) : (
                                                    <ImageOutlined fontSize="large" />
                                                )}
                                                <Typography
                                                    variant="caption"
                                                    sx={{ color: "rgba(255,255,255,0.9)" }}
                                                >
                                                    {mediaSizeLabel}
                                                </Typography>
                                            </div>
                                        </div>
                                    )}
                                </button>
                            )}
                            {message.attached_media === "contact" && (
                                <button className="flex w-full cursor-pointer flex-row items-center gap-x-3 rounded-lg bg-[#f7f5f3] p-3 dark:bg-[#1a1b1b]">
                                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                                        <Avatar
                                            sx={(theme) => ({
                                                width: 45,
                                                height: 45,
                                                backgroundColor:
                                                    theme.palette.mode === "dark"
                                                        ? "rgba(36,40,40,1)"
                                                        : "#FFFFFF",
                                                color:
                                                    theme.palette.mode === "dark"
                                                        ? "#f7f5f3"
                                                        : "#1a1b1b",
                                            })}
                                            src={message.contact?.contact_image || ""}
                                            alt={`${message.contact?.contact_name || "Contact"} Avatar`}
                                        >
                                            <Person />
                                        </Avatar>
                                    </div>
                                    <Box
                                        sx={{
                                            minWidth: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                        }}
                                    >
                                        {message.contact?.contact_name ? (
                                            <>
                                                <Typography
                                                    variant="subtitle2"
                                                    sx={{ fontWeight: 500 }}
                                                >
                                                    {message.contact.contact_name}
                                                </Typography>
                                                {message.contact.contact_phone && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ color: "text.secondary" }}
                                                    >
                                                        {message.contact.contact_phone}
                                                    </Typography>
                                                )}
                                            </>
                                        ) : message.sender_user_id ? (
                                            <Typography variant="body2">
                                                {message.sender_user_id}
                                            </Typography>
                                        ) : null}
                                    </Box>
                                </button>
                            )}
                            <CardContent
                                sx={{
                                    px: "8px",
                                    py:
                                        message.attached_media === "voice"
                                            ? "0px"
                                            : "8px",
                                    paddingBottom:
                                        message.attached_media === "voice"
                                            ? "0px !important"
                                            : "8px !important",
                                    position:
                                        message.attached_media === "voice"
                                            ? "absolute"
                                            : "relative",
                                    bottom:
                                        message.attached_media === "voice"
                                            ? 3
                                            : undefined,
                                    right:
                                        message.attached_media === "voice"
                                            ? 3
                                            : undefined,
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "row",
                                        alignItems: "end",
                                        justifyContent: "space-between",
                                        width: "100%",
                                        gap: 3,
                                        position: "relative",
                                    }}
                                >
                                    <Box
                                        sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                display: "-webkit-box",
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {message.message_text_content}
                                        </Typography>
                                    </Box>
                                    <Box
                                        sx={{
                                            flexShrink: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{ color: "gray" }}
                                        >
                                            {message.created_at.toLocaleTimeString("en-US", {
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })}
                                        </Typography>
                                        {isSender && (
                                            <>
                                                {message.client_status === "sending" && (
                                                    <AccessTime
                                                        sx={{
                                                            fontSize: 14,
                                                            color: "gray",
                                                        }}
                                                    />
                                                )}
                                                {message.client_status === "failed" && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={onRetry}
                                                        sx={{
                                                            p: 0.25,
                                                            color: "#d32f2f",
                                                        }}
                                                    >
                                                        <ErrorOutline
                                                            sx={{ fontSize: 16 }}
                                                        />
                                                    </IconButton>
                                                )}
                                                {(message.client_status === "sent" ||
                                                    !message.client_status) && (
                                                    <DoneAll
                                                        sx={{
                                                            fontSize: 16,
                                                            color: "#53bdeb",
                                                        }}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </Box>
                                </Box>
                            </CardContent>
                            {message.message_raction?.reaction_emoji && (
                                <Box
                                    sx={(theme) => ({
                                        position: "absolute",
                                        bottom: -20,
                                        right: isSender ? 12 : "auto",
                                        left: isSender ? "auto" : 12,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                        px: 0.8,
                                        py: 0.8,
                                        borderRadius: 999,
                                        fontSize: 14,
                                        lineHeight: 1,
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                                        backgroundColor:
                                            theme.palette.mode === "dark"
                                                ? "#212323"
                                                : "#FFFFFF",
                                        border:
                                            theme.palette.mode === "dark"
                                                ? "1.5px solid rgba(26,27,27,1)"
                                                : "1.5px solid #f5f5f5",
                                    })}
                                >
                                    <span>{message.message_raction.reaction_emoji}</span>
                                </Box>
                            )}
                        </Card>
                        {isSender &&
                            (isFirstInGroup ? (
                                <span
                                    className="text-[#DCF8C6] scale-x-[-1] transform dark:text-[#24352A]"
                                    aria-hidden="true"
                                    data-icon="tail-in"
                                >
                                    <svg
                                        viewBox="0 0 8 13"
                                        height="13"
                                        width={TAIL_WIDTH}
                                        preserveAspectRatio="xMidYMid meet"
                                        version="1.1"
                                        x="0px"
                                        y="0px"
                                        enableBackground="new 0 0 8 13"
                                    >
                                        <title>tail-in</title>
                                        <path
                                            opacity="0.13"
                                            fill="currentColor"
                                            d="M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M1.533,2.568L8,11.193V0L2.812,0C1.042,0,0.474,1.156,1.533,2.568z"
                                        />
                                    </svg>
                                </span>
                            ) : (
                                <div style={{ width: TAIL_WIDTH, flexShrink: 0 }} />
                            ))}
                    </div>
                    {!isSelectMode && !isSender && (
                        <div className="flex flex-row items-center gap-x-1">
                            <ChatRoomForwardButton />
                            {isListEnter && <ChatRoomReactionButton />}
                        </div>
                    )}
                </div>
            </ListItemButton>
        </ListItem>
    );
}
