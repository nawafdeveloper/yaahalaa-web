"use client";

import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import mockChats from "@/mocks/chat-items";
import { Close, CloseOutlined, Group, Person, SearchOutlined, Send, ShortcutRounded } from "@mui/icons-material";
import {
    Avatar,
    Box,
    Checkbox,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Modal,
    TextField,
    Typography,
    Zoom,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import React, { useRef, useState } from "react";

export default function ChatRoomForwardButton() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;

    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChatsToForward, setSelectedChatsToForward] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClear = () => {
        setSearchQuery("");
        inputRef.current?.blur();
    };

    return (
        <>
            <IconButton onClick={() => setOpen(true)} sx={{ color: "gray" }}>
                <ShortcutRounded fontSize="small" />
            </IconButton>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                closeAfterTransition
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Zoom in={open} timeout={300}>
                    <Box
                        sx={(theme) => ({
                            backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#FFFFFF",
                            boxShadow: 0,
                            p: 0,
                            borderRadius: "18px",
                            width: '440px',
                            marginY: 'auto',
                            height: '100%',
                            maxHeight: "calc(100vh - 200px)",
                            overflow: 'hidden',
                            position: 'relative'
                        })}
                    >
                        <div className="flex flex-row items-center gap-x-3 p-2">
                            <IconButton onClick={() => setOpen(false)}>
                                <Close />
                            </IconButton>
                            <Typography>{isRTL ? "إعادة التوجيه إلى" : "Forward message to"}</Typography>
                        </div>
                        <div className="px-5">
                            <TextField
                                hiddenLabel
                                id="filled-search-bar"
                                variant="filled"
                                size="small"
                                placeholder={isRTL ? "إبحث عن رقم أو جهة إتصال" : "Search name or number"}
                                fullWidth
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                inputRef={inputRef}
                                sx={(theme) => ({
                                    "& .MuiFilledInput-root": {
                                        borderRadius: 8,
                                        "&.Mui-focused": {
                                            outline: "2px solid #25D366",
                                            backgroundColor: theme.palette.mode === "dark" ? "#2B2C2C" : "#ffffff",
                                        },
                                    },
                                    width: '100%',
                                })}
                                InputProps={{
                                    disableUnderline: true,
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchOutlined
                                                sx={{
                                                    color: (theme) => (theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"),
                                                    width: 20,
                                                    height: 20,
                                                }}
                                            />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchQuery ? (
                                        <InputAdornment position="end">
                                            <IconButton onClick={handleClear} size="small">
                                                <CloseOutlined
                                                    sx={{
                                                        color: (theme) => (theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"),
                                                        width: 18,
                                                        height: 18,
                                                    }}
                                                />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : null,
                                }}
                            />
                        </div>
                        <div className="my-5 px-6">
                            <Typography
                                variant="caption"
                                sx={{
                                    fontWeight: 600,
                                    color: (theme) => (theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"),
                                    fontSize: 14,
                                }}
                            >
                                {isRTL ? "المحادثات الأخيرة" : "Recent chats"}
                            </Typography>
                        </div>
                        <List sx={{ bgcolor: 'transparent', overflowY: "scroll", height: "83%", paddingX: '20px' }}>
                            {mockChats.map((item) => (
                                <ListItem
                                    disablePadding
                                    key={item.chat_id}
                                >
                                    <ListItemButton
                                        onClick={() =>
                                            setSelectedChatsToForward((prev) =>
                                                prev.includes(item.chat_id)
                                                    ? prev.filter((id) => id !== item.chat_id)
                                                    : [...prev, item.chat_id]
                                            )
                                        }
                                        sx={(theme) => ({
                                            display: 'flex',
                                            flexDirection: isRTL ? 'row-reverse' : 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderRadius: 3,
                                            backgroundColor: "transparent",
                                            boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                                            textTransform: "inherit",
                                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",

                                            "&:hover": {
                                                boxShadow: "0px 4px 20px rgba(0,0,0,0)",
                                                backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                                            },
                                            "& .MuiListItemText-secondary": {
                                                maxWidth: "100%",
                                            },
                                        })}
                                    >
                                        <ListItemIcon sx={{ minWidth: 0 }}>
                                            <Checkbox
                                                edge="start"
                                                checked={selectedChatsToForward.includes(item.chat_id)}
                                                tabIndex={-1}
                                                disableRipple
                                                sx={{
                                                    '&.Mui-checked': {
                                                        color: "#25D366",
                                                    },
                                                }}
                                            />
                                        </ListItemIcon>
                                        <div className='flex flex-row items-center'>
                                            <ListItemAvatar>
                                                <Avatar
                                                    sx={(theme) => ({
                                                        width: 45,
                                                        height: 45,
                                                        backgroundColor: theme.palette.mode === "dark" ? "#103529" : "#D9FDD3",
                                                        color: theme.palette.mode === "dark" ? "#25D366" : "#1F4E2E",
                                                    })}
                                                    src={item.avatar || ""}
                                                >
                                                    {item.chat_type === 'group' ? <Group /> : <Person />}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={item.last_message_sender_nickname}
                                                sx={{
                                                    "& .MuiListItemText-secondary": {
                                                        color: (theme) => theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                                    },
                                                    overflow: "hidden",
                                                }}
                                                secondary={
                                                    item.last_message_context
                                                }
                                                secondaryTypographyProps={{
                                                    noWrap: true,
                                                    sx: {
                                                        overflow: "hidden",
                                                        display: "block",
                                                        maxWidth: "100%",
                                                        color: (theme) => theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                                                    },
                                                }}
                                            />
                                        </div>
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                        <AnimatePresence>
                            {selectedChatsToForward.length > 0 && (
                                <motion.div
                                    initial={{ y: 80, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 80, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="absolute z-10 bottom-0 left-0 right-0 dark:bg-[#2B2C2C] bg-[#F0F0F0] flex px-4 py-3 flex-row items-center justify-between"
                                >
                                    <span
                                        style={{
                                            display: 'block',
                                            maxWidth: '70%',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {selectedChatsToForward.join(', ')}
                                    </span>

                                    <IconButton
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
                                        <Send className={`${isRTL ? "rotate-180" : ""}`} />
                                    </IconButton>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Box>
                </Zoom>
            </Modal>
        </>
    );
}
