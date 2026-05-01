"use client";

import { useChatTyping } from "@/hooks/use-chat-typing";
import { useSendChatMessage } from "@/hooks/use-send-chat-message";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useMediaAttachmentStore } from "@/store/media-attachment-store";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { Close, Send } from "@mui/icons-material";
import {
    Alert,
    Box,
    CircularProgress,
    IconButton,
    Snackbar,
    TextField,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { LazyLoadImage } from "react-lazy-load-image-component";

export default function MediaAttachmentContainer() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const attachment = useMediaAttachmentStore((state) => state.attachment);
    const clearMediaAttachment = useMediaAttachmentStore(
        (state) => state.clearMediaAttachment
    );
    const chatId = attachment?.chatId ?? null;
    const draftValue = useActiveChatStore((state) =>
        chatId ? state.draftsByChatId[chatId] ?? "" : ""
    );
    const setDraft = useActiveChatStore((state) => state.setDraft);
    const { sendAttachment } = useSendChatMessage();
    const { handleDraftChange, stopTyping } = useChatTyping(chatId);
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, [attachment?.id]);

    useEffect(() => {
        if (attachment?.mediaType !== "video" || !videoRef.current) {
            return;
        }

        videoRef.current.play().catch(() => {});
    }, [attachment?.id, attachment?.mediaType]);

    if (!attachment || !chatId) {
        return null;
    }

    const handleCancel = () => {
        stopTyping(chatId);
        clearMediaAttachment();
    };

    const handleSend = async () => {
        if (isSending) {
            return;
        }

        setIsSending(true);
        setErrorMessage(null);

        try {
            const sent = await sendAttachment({
                file: attachment.file,
                attachedMedia: attachment.mediaType,
                chatId,
                text: draftValue.trim().length > 0 ? draftValue : null,
            });

            if (!sent) {
                throw new Error("Failed to send attachment.");
            }

            setDraft(chatId, "");
            stopTyping(chatId);
            clearMediaAttachment();
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to send attachment."
            );
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Box
            sx={(theme) => ({
                height: "100%",
                width: "100%",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#ffffff",
            })}
        >
            <Box
                sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    px: 2,
                    py: 1,
                    borderBottom: `1px solid ${
                        theme.palette.mode === "dark" ? "#2f3131" : "#ececec"
                    }`,
                })}
            >
                <IconButton
                    type="button"
                    size="small"
                    onClick={handleCancel}
                    disabled={isSending}
                    sx={(theme) => ({
                        color: theme.palette.mode === "dark" ? "#aebac1" : "#54656f",
                    })}
                >
                    <Close />
                </IconButton>
            </Box>
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                }}
            >
                {attachment.mediaType === "photo" ? (
                    <LazyLoadImage
                        alt=""
                        effect="blur"
                        src={attachment.objectUrl}
                        draggable={false}
                        wrapperProps={{
                            style: {
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                width: "100%",
                            },
                        }}
                        style={{
                            height: "100%",
                            width: "100%",
                            maxHeight: "100%",
                            maxWidth: "100%",
                            objectFit: "contain",
                            display: "block",
                            pointerEvents: "none",
                        }}
                    />
                ) : (
                    <video
                        ref={videoRef}
                        src={attachment.objectUrl}
                        controls
                        playsInline
                        draggable={false}
                        style={{
                            height: "100%",
                            width: "100%",
                            maxHeight: "100%",
                            maxWidth: "100%",
                            objectFit: "contain",
                            display: "block",
                            backgroundColor: "#000000",
                        }}
                    />
                )}
            </Box>
            <Box
                sx={(theme) => ({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 3,
                    py: 2,
                    gap: 2,
                    borderTop: `1px solid ${
                        theme.palette.mode === "dark" ? "#404040" : "#d4d4d4"
                    }`,
                })}
            >
                <TextField
                    hiddenLabel
                    id="filled-media-attachment-message-bar"
                    variant="filled"
                    size="medium"
                    placeholder={
                        isRTL
                            ? "\u0627\u0643\u062a\u0628 \u0631\u0633\u0627\u0644\u0629"
                            : "Type a message"
                    }
                    fullWidth
                    value={draftValue}
                    onChange={(event) => {
                        setDraft(chatId, event.target.value);
                        handleDraftChange(event.target.value);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSend();
                        }
                    }}
                    inputRef={inputRef}
                    disabled={isSending}
                    sx={(theme) => ({
                        "& .MuiFilledInput-root": {
                            borderRadius: 8,
                            px: 3,
                            backgroundColor:
                                theme.palette.mode === "dark" ? "#242626" : "#f7f5f3",
                            "&.Mui-focused": {
                                outline: "2px solid #25D366",
                                backgroundColor:
                                    theme.palette.mode === "dark" ? "#242626" : "#ffffff",
                            },
                            "&:hover": {
                                backgroundColor:
                                    theme.palette.mode === "dark" ? "#242626" : "#ffffff",
                            },
                            "&::before": { display: "none" },
                            "&::after": { display: "none" },
                        },
                    })}
                    InputProps={{
                        disableUnderline: true,
                    }}
                />
                <IconButton
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={isSending}
                    sx={(theme) => ({
                        backgroundColor: "#25D366",
                        color: theme.palette.mode === "dark" ? "#161717" : "#ffffff",
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        "&:hover": {
                            backgroundColor: "#25D366",
                        },
                        transform: isRTL ? "rotate(180deg)" : "none",
                    })}
                >
                    {isSending ? (
                        <CircularProgress size={22} sx={{ color: "inherit" }} />
                    ) : (
                        <Send />
                    )}
                </IconButton>
            </Box>
            <Snackbar
                open={Boolean(errorMessage)}
                autoHideDuration={4000}
                onClose={() => setErrorMessage(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setErrorMessage(null)}
                    severity="error"
                    variant="filled"
                >
                    {errorMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
}
