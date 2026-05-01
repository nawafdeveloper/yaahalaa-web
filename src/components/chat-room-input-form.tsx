"use client";

import {
    CloseOutlined,
    DeleteOutlined,
    Mic,
    MicNoneOutlined,
    Pause,
    PlayArrow,
    Send,
} from "@mui/icons-material";
import { Box, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ChatRoomInputAttachButton from "./chat-room-input-attach-button";
import ChatRoomInputEmojiButton from "./chat-room-input-emoji-button";
import RecordTimer from "./record-timer";
import {
    useVoiceVisualizer,
    VoiceVisualizer,
} from "react-voice-visualizer";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import { useSendChatMessage } from "@/hooks/use-send-chat-message";
import { useChatTyping } from "@/hooks/use-chat-typing";
import { authClient } from "@/lib/auth-client";
import { useDecryptedContacts } from "@/hooks/use-decrypted-contacts";
import { findContactByUserId, getContactDisplayName } from "@/lib/contact-display";
import { getReplyMessageLabel } from "@/lib/message-reply";

const getHue = (userId: string | undefined): number => {
    if (!userId) {
        return 0;
    }

    let hash = 0;
    for (let index = 0; index < userId.length; index++) {
        hash = (hash << 5) - hash + userId.charCodeAt(index);
        hash |= 0;
    }

    return Math.abs(hash) % 360;
};

export default function ChatRoomInputForm() {
    const { data: session } = authClient.useSession();
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [micHover, setMicHover] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const draftValue = useActiveChatStore((state) =>
        selectedChatId ? state.draftsByChatId[selectedChatId] ?? "" : ""
    );
    const replyDraft = useActiveChatStore((state) =>
        selectedChatId ? state.replyDraftByChatId[selectedChatId] ?? null : null
    );
    const setDraft = useActiveChatStore((state) => state.setDraft);
    const clearReplyDraft = useActiveChatStore((state) => state.clearReplyDraft);
    const { sendAttachment, sendMessage } = useSendChatMessage();
    const { handleDraftChange, stopTyping } = useChatTyping(selectedChatId);
    const { contacts } = useDecryptedContacts();
    const [pendingVoiceSend, setPendingVoiceSend] = useState(false);
    const [voiceSendInFlight, setVoiceSendInFlight] = useState(false);
    const voiceSendInFlightRef = useRef(false);
    const voiceSendBlobRef = useRef<Blob | null>(null);
    const isMountedRef = useRef(true);

    const handleSend = async () => {
        if (!selectedChatId) {
            return;
        }

        stopTyping(selectedChatId);
        await sendMessage({
            text: draftValue,
            chatId: selectedChatId,
        });
    };

    const recorderControls = useVoiceVisualizer();
    const {
        startRecording,
        stopRecording,
        togglePauseResume,
        isPausedRecording,
        isRecordingInProgress,
        isProcessingRecordedAudio,
        recordedBlob,
        formattedRecordingTime,
        clearCanvas,
    } = recorderControls;

    const sendAttachmentRef = useRef(sendAttachment);
    const clearCanvasRef = useRef(clearCanvas);

    useEffect(() => {
        sendAttachmentRef.current = sendAttachment;
    }, [sendAttachment]);

    useEffect(() => {
        clearCanvasRef.current = clearCanvas;
    }, [clearCanvas]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (replyDraft) {
            inputRef.current?.focus();
        }
    }, [replyDraft]);

    const replySenderContact = findContactByUserId(
        contacts,
        replyDraft?.original_sender_user_id
    );
    const replySenderDisplayName =
        replyDraft?.original_sender_user_id === session?.user.id
            ? "You"
            : replySenderContact
              ? getContactDisplayName(replySenderContact)
              : replyDraft?.original_sender_user_id ?? "";
    const replyPreview = getReplyMessageLabel(replyDraft);

    useEffect(() => {
        if (!pendingVoiceSend || !recordedBlob || !selectedChatId) {
            return;
        }

        if (
            voiceSendInFlightRef.current ||
            voiceSendBlobRef.current === recordedBlob
        ) {
            return;
        }

        const sendRecordedVoice = async () => {
            voiceSendInFlightRef.current = true;
            voiceSendBlobRef.current = recordedBlob;
            setVoiceSendInFlight(true);

            try {
                const extension =
                    recordedBlob.type.split("/")[1]?.split(";")[0] ?? "webm";
                const recordedFile = new File(
                    [recordedBlob],
                    `voice-message.${extension}`,
                    {
                        type: recordedBlob.type || "audio/webm",
                        lastModified: Date.now(),
                    }
                );

                await sendAttachmentRef.current({
                    file: recordedFile,
                    attachedMedia: "voice",
                    chatId: selectedChatId,
                });
            } finally {
                voiceSendInFlightRef.current = false;
                voiceSendBlobRef.current = null;

                if (isMountedRef.current) {
                    setPendingVoiceSend(false);
                    setVoiceSendInFlight(false);
                    clearCanvasRef.current();
                }
            }
        };

        void sendRecordedVoice();
    }, [pendingVoiceSend, recordedBlob, selectedChatId]);

    const placeholder = useMemo(
        () =>
            isRTL
                ? "أكتب رسالة"
                : "Type a message",
        [isRTL]
    );

    return (
        <div className="absolute right-2 bottom-2 left-2 z-50 md:mx-auto md:max-w-7xl">
            {isRecordingInProgress ? (
                <div className="relative mx-auto flex w-100 flex-row items-center justify-between rounded-full bg-gray-100 p-1.25 shadow-sm dark:bg-[#242626] lg:w-161">
                    <div className="relative flex items-center gap-1">
                        <IconButton
                            type="button"
                            onClick={() => {
                                setPendingVoiceSend(false);
                                stopRecording();
                                clearCanvas();
                            }}
                            size="medium"
                            disabled={voiceSendInFlight}
                        >
                            <DeleteOutlined />
                        </IconButton>
                        <RecordTimer recordingTime={formattedRecordingTime} />
                        <div className="relative mx-2 min-w-40 flex-1 overflow-hidden lg:min-w-100">
                            <VoiceVisualizer
                                key={isRecordingInProgress ? "recording" : "idle"}
                                controls={recorderControls}
                                isControlPanelShown={false}
                                rounded={10}
                                height={40}
                                barWidth={4}
                                speed={0.5}
                            />
                        </div>
                        <IconButton
                            type="button"
                            onClick={() => togglePauseResume()}
                            size="medium"
                            disabled={voiceSendInFlight}
                        >
                            {isPausedRecording ? <PlayArrow /> : <Pause />}
                        </IconButton>
                        <IconButton
                            type="button"
                            onClick={() => {
                                setPendingVoiceSend(true);
                                stopRecording();
                            }}
                            size="medium"
                            disabled={voiceSendInFlight || isProcessingRecordedAudio}
                            sx={{
                                backgroundColor: "#25D366",
                                color: "#161717",
                                "&:hover": {
                                    backgroundColor: "#25D366",
                                    color: "#161717",
                                },
                            }}
                        >
                            <Send className={isRTL ? "rotate-180" : ""} />
                        </IconButton>
                    </div>
                </div>
            ) : (
                <Box
                    sx={(theme) => ({
                        overflow: "hidden",
                        borderRadius: replyDraft ? "18px" : 8,
                        boxShadow: "0px 2px 2px rgba(0,0,0,0.08)",
                        backgroundColor:
                            theme.palette.mode === "dark" ? "#242626" : "#ffffff",
                    })}
                >
                    {replyDraft && (
                        <Box sx={{ px: 1.25, pt: 1, pb: 0.25 }}>
                            <Box
                                sx={(theme) => {
                                    const hue = getHue(
                                        replyDraft.original_sender_user_id
                                    );
                                    const accent = `hsl(${hue}, 80%, ${
                                        theme.palette.mode === "dark" ? "60%" : "35%"
                                    })`;

                                    return {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minWidth: 0,
                                        px: 1,
                                        py: 0.65,
                                        borderLeft: `4px solid ${accent}`,
                                        borderRadius: 1.5,
                                        backgroundColor:
                                            theme.palette.mode === "dark"
                                                ? "rgba(255,255,255,0.04)"
                                                : "rgba(0,0,0,0.04)",
                                    };
                                }}
                            >
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography
                                        variant="caption"
                                        sx={(theme) => {
                                            const hue = getHue(
                                                replyDraft.original_sender_user_id
                                            );

                                            return {
                                                display: "block",
                                                fontWeight: 600,
                                                lineHeight: 1.35,
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
                                            display: "block",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {replyPreview}
                                    </Typography>
                                </Box>
                                <IconButton
                                    type="button"
                                    size="small"
                                    aria-label="Cancel reply"
                                    onClick={() => {
                                        if (selectedChatId) {
                                            clearReplyDraft(selectedChatId);
                                        }
                                    }}
                                >
                                    <CloseOutlined sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Box>
                        </Box>
                    )}
                    <TextField
                        hiddenLabel
                        id="filled-chat-input-bar"
                        variant="filled"
                        size="small"
                        placeholder={placeholder}
                        fullWidth
                        value={draftValue}
                        onChange={(event) => {
                            if (!selectedChatId) {
                                return;
                            }
                            setDraft(selectedChatId, event.target.value);
                            handleDraftChange(event.target.value);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void handleSend();
                            }
                        }}
                        inputRef={inputRef}
                        sx={(theme) => ({
                            "& .MuiFilledInput-root": {
                                borderRadius: replyDraft ? "0 0 18px 18px" : 8,
                                boxShadow: "none",
                                paddingY: "5px",
                                paddingX: "5px",
                                backgroundColor:
                                    theme.palette.mode === "dark"
                                        ? "#242626"
                                        : "#ffffff",
                                "&.Mui-focused": {
                                    outline: "none",
                                    backgroundColor:
                                        theme.palette.mode === "dark"
                                            ? "#242626"
                                            : "#ffffff",
                                },
                                "&:hover": {
                                    backgroundColor:
                                        theme.palette.mode === "dark"
                                            ? "#242626"
                                            : "#ffffff",
                                },
                                "&::before": { display: "none" },
                                "&::after": { display: "none" },
                            },
                        })}
                        InputProps={{
                            disableUnderline: true,
                            startAdornment: (
                                <InputAdornment position="start">
                                    <ChatRoomInputAttachButton />
                                    <ChatRoomInputEmojiButton
                                        messageInput={draftValue}
                                        setMessageInput={(value) => {
                                            if (!selectedChatId) {
                                                return;
                                            }
                                            setDraft(selectedChatId, value);
                                            handleDraftChange(value);
                                        }}
                                    />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    {draftValue.trim().length > 0 ? (
                                        <IconButton
                                            type="button"
                                            onClick={() => void handleSend()}
                                            size="medium"
                                            sx={{
                                                backgroundColor: "#25D366",
                                                color: "#161717",
                                                "&:hover": {
                                                    backgroundColor: "#25D366",
                                                    color: "#161717",
                                                },
                                            }}
                                        >
                                            <Send className={isRTL ? "rotate-180" : ""} />
                                        </IconButton>
                                    ) : (
                                        <IconButton
                                            type="button"
                                            onClick={() => startRecording()}
                                            size="medium"
                                            onMouseEnter={() => setMicHover(true)}
                                            onMouseLeave={() => setMicHover(false)}
                                            sx={{
                                                transition: "background-color 0.2s ease",
                                                "&:hover": {
                                                    backgroundColor: "#25D366",
                                                    color: "#161717",
                                                },
                                            }}
                                        >
                                            {micHover ? <Mic /> : <MicNoneOutlined />}
                                        </IconButton>
                                    )}
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
            )}
        </div>
    );
}
