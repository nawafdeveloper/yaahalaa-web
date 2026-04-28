"use client";

import Avatar from '@mui/material/Avatar';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import React from 'react'
import { AttachFileOutlined, DoneAll, Group, ImageOutlined, KeyboardVoiceOutlined, Person, SlowMotionVideoOutlined } from '@mui/icons-material';
import Badge from '@mui/material/Badge';
import ChatItemMoreButtonMenu from './chat-item-more-button-menu';
import { ChatItemType } from '@/types/chats.type';
import ListItemButton from '@mui/material/ListItemButton';
import { formatRelativeDate } from '@/lib/date-formatter';
import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { useActiveChatStore } from '@/store/use-active-chat-store';
import { authClient } from '@/lib/auth-client';
import { getChatDisplayName } from '@/lib/chat-utils';

type Props = {
    chat_item: ChatItemType;
}

export default function ChatItem({ chat_item }: Props) {
    const { data: session } = authClient.useSession();
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const setSelectedChatId = useActiveChatStore((state) => state.setSelectedChatId);
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const isSelected = selectedChatId === chat_item.chat_id;
    const currentPhone = (session?.user as { phoneNumber?: string | null } | undefined)
        ?.phoneNumber ?? null;
    const chatTitle = getChatDisplayName(chat_item, currentPhone);

    const secondaryActionContent = (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
            }}
        >
            <span
                className={`text-[13px] font-light ${chat_item.is_unreaded_chat
                    ? "text-[#25D366]"
                    : "dark:text-[#A5A5A5] text-[#636261]"
                    }`}
            >
                {formatRelativeDate(chat_item.updated_at, locale)}
            </span>
            <div
                className="badge-slot"
                style={{
                    position: "relative",
                    width: 28,
                    height: 28,
                }}
            >
                <Badge
                    badgeContent={chat_item.unreaded_messages_length}
                    color="success"
                    className="chat-badge"
                    sx={(theme) => ({
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        transition: "all 100ms ease",
                        '& .MuiBadge-badge': {
                            backgroundColor: '#25D366',
                            color: theme.palette.mode === "dark" ? "#000000" : "#ffffff",
                        },
                    })}
                />
                <ChatItemMoreButtonMenu chat_type={chat_item.chat_type} />
            </div>
        </div>
    );

    return (
        <ListItemButton
            onClick={() => setSelectedChatId(chat_item.chat_id)}
            sx={(theme) => ({
                width: "100%",
                borderRadius: 3,
                padding: 0,
                marginY: '2px',
                backgroundColor: isSelected
                    ? theme.palette.mode === "dark"
                        ? "#2B2C2C"
                        : "#EAE9E7"
                    : "transparent",
                boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                textTransform: "inherit",
                color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                direction: isRTL ? 'rtl' : 'ltr',

                "&:hover": {
                    boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                    backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                    "& .chat-badge": {
                        transform: isRTL ? "translate(28px, -50%)" : "translate(-28px, -50%)",
                        opacity: 1,
                    },
                    "& .chat-hover-action": {
                        transform: "translate(-50%, -50%)",
                        opacity: 1,
                        pointerEvents: "auto",
                    },
                    "& .MuiListItemText-secondary": {
                        maxWidth: "calc(100% - 30px)",
                    },
                },
                "& .MuiListItemText-secondary": {
                    maxWidth: "100%",
                },
            })}
        >
            <ListItem
                sx={{
                    paddingY: 1,
                    paddingX: 2,
                    direction: isRTL ? 'rtl' : 'ltr',
                }}
            >
                <ListItemAvatar
                    sx={{
                        marginRight: isRTL ? 0 : 2,
                        marginLeft: isRTL ? 2 : 0,
                    }}
                >
                    <Avatar
                        sx={(theme) => ({
                            width: 45,
                            height: 45,
                            backgroundColor: theme.palette.mode === "dark" ? "#103529" : "#D9FDD3",
                            color: theme.palette.mode === "dark" ? "#25D366" : "#1F4E2E",
                        })}
                        src={chat_item.avatar || ""}
                    >
                        {chat_item.chat_type === 'group' ? <Group /> : <Person />}
                    </Avatar>
                </ListItemAvatar>
                <ListItemText
                    primary={chatTitle}
                    sx={{
                        transition: "max-width 100ms ease",
                        maxWidth: "75%",
                        textAlign: isRTL ? 'right' : 'left',
                        "& .MuiListItemText-primary": {
                            textAlign: isRTL ? 'right' : 'left',
                        },
                        "& .MuiListItemText-secondary": {
                            color: (theme) =>
                                chat_item.is_unreaded_chat ? theme.palette.mode === "dark" ? "white" : "black" : theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                            textAlign: isRTL ? 'right' : 'left',
                            direction: isRTL ? 'rtl' : 'ltr',
                        },
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        display: "block",
                    }}
                    secondary={
                        <React.Fragment>
                            {chat_item.chat_type === 'group' && chat_item.last_message_sender_is_me && <DoneAll fontSize="small" />}
                            {chat_item.chat_type === 'group' && !chat_item.last_message_sender_is_me && `${chat_item.last_message_sender_nickname}:`}
                            {chat_item.last_message_media && (
                                <>
                                    {chat_item.last_message_media === 'photo' && (
                                        <ImageOutlined fontSize="small" />
                                    )}
                                    {chat_item.last_message_media === 'video' && (
                                        <SlowMotionVideoOutlined fontSize="small" />
                                    )}
                                    {chat_item.last_message_media === 'voice' && (
                                        <KeyboardVoiceOutlined fontSize="small" />
                                    )}
                                    {chat_item.last_message_media === 'file' && (
                                        <AttachFileOutlined fontSize="small" />
                                    )}
                                </>
                            )}
                            {'  '}
                            {chat_item.last_message_media ?
                                chat_item.last_message_media === 'photo' ? 'Image' :
                                    chat_item.last_message_media === 'video' ? 'Video' :
                                        chat_item.last_message_media === 'voice' ? 'Voice' :
                                            'File' :
                                chat_item.last_message_context
                            }
                        </React.Fragment>
                    }
                    secondaryTypographyProps={{
                        noWrap: true,
                        sx: {
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                            maxWidth: "100%",
                            transition: "max-width 100ms ease",
                            color: (theme) =>
                                chat_item.is_unreaded_chat
                                    ? theme.palette.mode === "dark"
                                        ? "white"
                                        : "black"
                                    : theme.palette.mode === "dark"
                                        ? "#A5A5A5"
                                        : "#636261",
                            direction: isRTL ? 'rtl' : 'ltr',
                            textAlign: isRTL ? 'right' : 'left',
                        },
                    }}
                />
                <div
                    style={{
                        marginLeft: isRTL ? 0 : 'auto',
                        marginRight: isRTL ? 'auto' : 0,
                        paddingLeft: isRTL ? 2 : 0,
                        paddingRight: isRTL ? 0 : 2,
                    }}
                >
                    {secondaryActionContent}
                </div>
            </ListItem>
        </ListItemButton>
    )
}
