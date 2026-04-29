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
import React, { useMemo, useRef, useState } from "react";
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

export default function ChatRoomInputForm() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [micHover, setMicHover] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const draftValue = useActiveChatStore((state) =>
        selectedChatId ? state.draftsByChatId[selectedChatId] ?? "" : ""
    );
    const setDraft = useActiveChatStore((state) => state.setDraft);
    const { sendMessage } = useSendChatMessage();
    const { handleDraftChange, stopTyping } = useChatTyping(selectedChatId);

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
        formattedRecordingTime,
        clearCanvas,
    } = recorderControls;

    const placeholder = useMemo(
        () =>
            isRTL
                ? "\u0627\u0628\u062f\u0623 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629"
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
                                stopRecording();
                                clearCanvas();
                            }}
                            size="medium"
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
                        >
                            {isPausedRecording ? <PlayArrow /> : <Pause />}
                        </IconButton>
                        <IconButton
                            type="button"
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
                            <Send className={isRTL ? "rotate-180" : ""} />
                        </IconButton>
                    </div>
                </div>
            ) : (
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
                            borderRadius: 8,
                            boxShadow: "0px 2px 2px rgba(0,0,0,0.08)",
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
            )}
        </div>
    );
}
