"use client";

import { Message } from "@/types/messages.type";
import {
    DeleteForeverOutlined,
    InsertDriveFileOutlined,
    ImageOutlined,
    Person,
    PushPinOutlined,
    VideocamRounded,
    KeyboardVoiceOutlined,
} from "@mui/icons-material";
import { IconButton, Typography } from "@mui/material";
import React from "react";

type Props = {
    pinnedMessage: Message;
    onOpen: () => void;
    onUnpin?: () => void;
};

function getPinnedMessageLabel(message: Message) {
    if (message.message_text_content?.trim()) {
        return message.message_text_content;
    }

    switch (message.attached_media) {
        case "photo":
            return "Photo";
        case "video":
            return "Video";
        case "voice":
            return "Voice message";
        case "file":
            return message.media_file_name ?? "File";
        case "contact":
            return message.contact?.contact_name ?? "Contact";
        default:
            return "Pinned message";
    }
}

function getPinnedMessageIcon(message: Message) {
    switch (message.attached_media) {
        case "photo":
            return <ImageOutlined fontSize="inherit" />;
        case "video":
            return <VideocamRounded fontSize="inherit" />;
        case "voice":
            return <KeyboardVoiceOutlined fontSize="inherit" />;
        case "file":
            return <InsertDriveFileOutlined fontSize="inherit" />;
        case "contact":
            return <Person fontSize="inherit" />;
        default:
            return <PushPinOutlined fontSize="inherit" />;
    }
}

export default function ChatRoomPinContent({
    pinnedMessage,
    onOpen,
    onUnpin,
}: Props) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex cursor-pointer flex-row items-center justify-between bg-white px-4 py-2.5 duration-150 hover:bg-neutral-50 dark:bg-[#242626] hover:dark:bg-[#313434]"
        >
            <div className="flex min-w-0 flex-row items-center gap-x-2">
                <PushPinOutlined fontSize="inherit" className="shrink-0" />
                <span className="shrink-0 text-sm">
                    {getPinnedMessageIcon(pinnedMessage)}
                </span>
                <Typography
                    variant="caption"
                    sx={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                    }}
                >
                    {getPinnedMessageLabel(pinnedMessage)}
                </Typography>
            </div>
            {onUnpin ? (
                <IconButton
                    size="small"
                    onClick={(event) => {
                        event.stopPropagation();
                        onUnpin();
                    }}
                >
                    <DeleteForeverOutlined fontSize="inherit" />
                </IconButton>
            ) : null}
        </button>
    );
}
