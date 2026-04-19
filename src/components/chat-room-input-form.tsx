"use client";

import {
    DeleteOutlined,
    Mic,
    MicNoneOutlined,
    Pause,
    PlayArrow,
    Send,
} from "@mui/icons-material";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import React, { useCallback, useRef, useState } from "react";
import ChatRoomInputAttachButton from "./chat-room-input-attach-button";
import ChatRoomInputEmojiButton from "./chat-room-input-emoji-button";
import RecordTimer from "./record-timer";
import {
    useVoiceVisualizer,
    VoiceVisualizer,
} from "react-voice-visualizer";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { authClient } from "@/lib/auth-client";
import { useActiveChatStore } from "@/store/use-active-chat-store";

export default function ChatRoomInputForm() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [value, setValue] = useState("");
    const [micHover, setMicHover] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- Real user session & active chat ---------------------------------
    const { data: session } = authClient.useSession();
    const currentPhone = (session?.user as { phoneNumber?: string | null })
        ?.phoneNumber ?? null;
    const recipientPhone = useActiveChatStore((s) => s.recipientPhone);

    // --- Send handler -----------------------------------------------------
    const handleSend = useCallback(async () => {
        const trimmed = value.trim();
        if (!trimmed || !currentPhone || !recipientPhone) return;

        try {
            await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    senderPhone: currentPhone,
                    recipientPhone,
                    content: trimmed,
                }),
            });
            setValue("");
        } catch (err) {
            console.error("Failed to send message:", err);
        }
    }, [currentPhone, recipientPhone, value]);

    // --- Voice recorder ---------------------------------------------------
    const recorderControls = useVoiceVisualizer();
    const {
        startRecording,
        stopRecording,
        togglePauseResume,
        isPausedRecording,
        isRecordingInProgress,
        formattedRecordingTime,
        clearCanvas,
    } = recorderControls;

    return (
        <div className="absolute bottom-2 left-2 right-2 z-50 md:max-w-7xl md:mx-auto">
            {isRecordingInProgress ? (
                <div className="lg:w-161 w-100 relative mx-auto flex-row p-1.25 rounded-full shadow-sm bg-gray-100 dark:bg-[#242626] flex items-center justify-between">
                    <div className="flex items-center gap-1 relative">
                        <IconButton
                            onClick={() => {
                                stopRecording();
                                clearCanvas();
                            }}
                            size="medium"
                        >
                            <DeleteOutlined />
                        </IconButton>
                        <RecordTimer
                            recordingTime={formattedRecordingTime}
                        />
                        <div className="flex-1 mx-2 lg:min-w-100 min-w-40 relative overflow-hidden">
                            <VoiceVisualizer
                                key={
                                    isRecordingInProgress
                                        ? "recording"
                                        : "idle"
                                }
                                controls={recorderControls}
                                isControlPanelShown={false}
                                rounded={10}
                                height={40}
                                barWidth={4}
                                speed={0.5}
                            />
                        </div>
                        <IconButton
                            onClick={() => togglePauseResume()}
                            size="medium"
                        >
                            {isPausedRecording ? (
                                <PlayArrow />
                            ) : (
                                <Pause />
                            )}
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                stopRecording();
                                clearCanvas();
                            }}
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
                            <Send
                                className={`${isRTL ? "rotate-180" : ""}`}
                            />
                        </IconButton>
                    </div>
                </div>
            ) : (
                <TextField
                    hiddenLabel
                    id="filled-chat-input-bar"
                    variant="filled"
                    size="small"
                    placeholder={
                        isRTL ? "إبدأ المحادثة" : "Type a message"
                    }
                    fullWidth
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    inputRef={inputRef}
                    sx={(theme) => ({
                        "& .MuiFilledInput-root": {
                            borderRadius: 8,
                            boxShadow:
                                "0px 2px 2px rgba(0,0,0,0.08)",
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
                                    messageInput={value}
                                    setMessageInput={setValue}
                                />
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <InputAdornment position="end">
                                {value.trim().length > 0 ? (
                                    <IconButton
                                        onClick={handleSend}
                                        size="medium"
                                        sx={{
                                            backgroundColor: "#25D366",
                                            color: "#161717",
                                            "&:hover": {
                                                backgroundColor:
                                                    "#25D366",
                                                color: "#161717",
                                            },
                                        }}
                                    >
                                        <Send
                                            className={`${isRTL ? "rotate-180" : ""}`}
                                        />
                                    </IconButton>
                                ) : (
                                    <IconButton
                                        onClick={() =>
                                            startRecording()
                                        }
                                        size="medium"
                                        onMouseEnter={() =>
                                            setMicHover(true)
                                        }
                                        onMouseLeave={() =>
                                            setMicHover(false)
                                        }
                                        sx={{
                                            transition:
                                                "background-color 0.2s ease",
                                            "&:hover": {
                                                backgroundColor:
                                                    "#25D366",
                                                color: "#161717",
                                            },
                                        }}
                                    >
                                        {micHover ? (
                                            <Mic />
                                        ) : (
                                            <MicNoneOutlined />
                                        )}
                                    </IconButton>
                                )}
                            </InputAdornment>
                        ),
                    }}
                />
            )}
        </div>
    );
}
