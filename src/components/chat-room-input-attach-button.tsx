"use client";

import { useCryptoKeys } from "@/context/crypto";
import { useDecryptedContacts } from "@/hooks/use-decrypted-contacts";
import { useSendChatMessage } from "@/hooks/use-send-chat-message";
import { getContactDisplayName } from "@/lib/contact-display";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useActiveChatStore } from "@/store/use-active-chat-store";
import {
    AddOutlined,
    CalendarMonth,
    CameraAlt,
    Collections,
    Description,
    Headphones,
    Person,
    Poll,
} from "@mui/icons-material";
import {
    Alert,
    Avatar,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    List,
    ListItemAvatar,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Snackbar,
    Typography,
} from "@mui/material";
import React, { useMemo, useRef, useState } from "react";

export default function ChatRoomInputAttachButton() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { isReady } = useCryptoKeys();
    const selectedChatId = useActiveChatStore((state) => state.selectedChatId);
    const { contacts, isLoading: contactsLoading } = useDecryptedContacts();
    const { sendAttachment, sendContact } = useSendChatMessage();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [contactDialogOpen, setContactDialogOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const open = Boolean(anchorEl);
    const documentInputRef = useRef<HTMLInputElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const sortedContacts = useMemo(
        () =>
            [...contacts].sort((left, right) =>
                getContactDisplayName(left).localeCompare(
                    getContactDisplayName(right),
                    locale ?? undefined
                )
            ),
        [contacts, locale]
    );

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.preventDefault();
        setAnchorEl(event.currentTarget);
    };

    const handleClose = (event?: React.SyntheticEvent) => {
        event?.stopPropagation();
        event?.preventDefault();
        setAnchorEl(null);
    };

    const ensureAttachmentReady = () => {
        if (!selectedChatId) {
            setErrorMessage(isRTL ? "اختر محادثة أولاً" : "Select a chat first.");
            return false;
        }

        if (!isReady) {
            setErrorMessage(
                isRTL
                    ? "افتح مفاتيح التشفير أولاً لإرسال المرفقات"
                    : "Unlock your encryption keys first to send attachments."
            );
            return false;
        }

        return true;
    };

    const openPicker = (
        event: React.MouseEvent<HTMLElement>,
        ref: React.RefObject<HTMLInputElement | null>
    ) => {
        event.stopPropagation();
        event.preventDefault();

        if (!ensureAttachmentReady()) {
            handleClose();
            return;
        }

        setAnchorEl(null);
        window.setTimeout(() => ref.current?.click(), 0);
    };

    const sendSelectedFiles = async ({
        files,
        resolveAttachedMedia,
    }: {
        files: FileList | null;
        resolveAttachedMedia: (
            file: File
        ) => "photo" | "video" | "voice" | "file";
    }) => {
        if (!files?.length || !ensureAttachmentReady()) {
            return;
        }

        setIsSending(true);
        setErrorMessage(null);

        try {
            for (const file of Array.from(files)) {
                const sent = await sendAttachment({
                    file,
                    attachedMedia: resolveAttachedMedia(file),
                });

                if (!sent) {
                    throw new Error(`Failed to send ${file.name}`);
                }
            }
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to send attachment."
            );
        } finally {
            setIsSending(false);
        }
    };

    const handleContactShare = async (contactId: string) => {
        const selectedContact =
            contacts.find((contact) => contact.contact_id === contactId) ?? null;

        if (!selectedContact || !ensureAttachmentReady()) {
            return;
        }

        setIsSending(true);
        setErrorMessage(null);

        try {
            const sent = await sendContact({ contact: selectedContact });
            if (!sent) {
                throw new Error("Failed to share contact.");
            }
            setContactDialogOpen(false);
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "Failed to share contact."
            );
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div>
            <IconButton
                id="more-button"
                component="span"
                size="medium"
                className="chat-hover-action"
                disabled={isSending}
                aria-controls={open ? "attachment-menu" : undefined}
                aria-haspopup="true"
                aria-expanded={open ? "true" : undefined}
                onClick={handleClick}
            >
                <AddOutlined />
            </IconButton>
            <Menu
                id="attachment-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={() => handleClose()}
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "center",
                }}
                transformOrigin={{
                    vertical: "bottom",
                    horizontal: "center",
                }}
                PaperProps={{
                    sx: (theme) => ({
                        backgroundColor:
                            theme.palette.mode === "dark" ? "#222424" : "#ffffff",
                        borderRadius: 3,
                        boxShadow: "0px 4px 20px rgba(0,0,0,0.1)",
                        mt: -4,
                    }),
                }}
                slotProps={{
                    list: {
                        "aria-labelledby": "more-button",
                        sx: {
                            padding: 1,
                        },
                    },
                }}
            >
                <MenuItem
                    onClick={(event) => openPicker(event, documentInputRef)}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                    })}
                >
                    <ListItemIcon>
                        <Description
                            fontSize="medium"
                            sx={{
                                color: "#7F66FF",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                fontWeight: 500,
                                fontSize: "15px",
                            },
                        }}
                    >
                        {isRTL ? "مستند" : "Document"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={(event) => openPicker(event, mediaInputRef)}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                    })}
                >
                    <ListItemIcon>
                        <Collections
                            fontSize="medium"
                            sx={{
                                color: "#007BFC",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                fontWeight: 500,
                                fontSize: "15px",
                            },
                        }}
                    >
                        {isRTL ? "فيديوهات و صور" : "Photos & videos"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                    })}
                >
                    <ListItemIcon>
                        <CameraAlt
                            fontSize="medium"
                            sx={{
                                color: "#007BFC",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                fontWeight: 500,
                                fontSize: "15px",
                            },
                        }}
                    >
                        {isRTL ? "الكاميرا" : "Camera"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={(event) => openPicker(event, audioInputRef)}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                    })}
                >
                    <ListItemIcon>
                        <Headphones
                            fontSize="medium"
                            sx={{
                                color: "#FA6533",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                fontWeight: 500,
                                fontSize: "15px",
                            },
                        }}
                    >
                        {isRTL ? "صوتية" : "Audio"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();

                        if (!ensureAttachmentReady()) {
                            handleClose();
                            return;
                        }

                        setAnchorEl(null);
                        setContactDialogOpen(true);
                    }}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                    })}
                >
                    <ListItemIcon>
                        <Person
                            fontSize="medium"
                            sx={{
                                color: "#009DE2",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                fontWeight: 500,
                                fontSize: "15px",
                            },
                        }}
                    >
                        {isRTL ? "جهة إتصال" : "Contact"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                    })}
                >
                    <ListItemIcon>
                        <Poll
                            fontSize="medium"
                            sx={{
                                color: "#FFB938",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                fontWeight: 500,
                                fontSize: "15px",
                            },
                        }}
                    >
                        {isRTL ? "استطلاع رأي" : "Poll"}
                    </ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={handleClose}
                    sx={(theme) => ({
                        "&:hover": {
                            backgroundColor: theme.palette.mode === "dark" ? "#333" : "#eee",
                        },
                        borderRadius: 2,
                        paddingY: 1,
                        paddingX: 1,
                    })}
                >
                    <ListItemIcon>
                        <CalendarMonth
                            fontSize="medium"
                            sx={{
                                color: "#FF2E74",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primaryTypographyProps={{
                            sx: {
                                fontWeight: 500,
                                fontSize: "15px",
                            },
                        }}
                    >
                        {isRTL ? "حدث" : "Event"}
                    </ListItemText>
                </MenuItem>
            </Menu>
            <input
                ref={documentInputRef}
                type="file"
                hidden
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.7z,.csv"
                onChange={async (event) => {
                    await sendSelectedFiles({
                        files: event.target.files,
                        resolveAttachedMedia: () => "file",
                    });
                    event.target.value = "";
                }}
            />
            <input
                ref={mediaInputRef}
                type="file"
                hidden
                multiple
                accept="image/*,video/*"
                onChange={async (event) => {
                    await sendSelectedFiles({
                        files: event.target.files,
                        resolveAttachedMedia: (file) =>
                            file.type.startsWith("video/") ? "video" : "photo",
                    });
                    event.target.value = "";
                }}
            />
            <input
                ref={audioInputRef}
                type="file"
                hidden
                multiple
                accept="audio/*"
                onChange={async (event) => {
                    await sendSelectedFiles({
                        files: event.target.files,
                        resolveAttachedMedia: () => "voice",
                    });
                    event.target.value = "";
                }}
            />
            <Dialog
                open={contactDialogOpen}
                onClose={() => setContactDialogOpen(false)}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>
                    {isRTL ? "مشاركة جهة اتصال" : "Share contact"}
                </DialogTitle>
                <DialogContent sx={{ px: 0 }}>
                    {contactsLoading ? (
                        <div className="flex min-h-40 items-center justify-center">
                            <CircularProgress size={26} />
                        </div>
                    ) : sortedContacts.length === 0 ? (
                        <Typography sx={{ px: 3, py: 2, color: "text.secondary" }}>
                            {isRTL
                                ? "لا توجد جهات اتصال متاحة للمشاركة"
                                : "No contacts available to share."}
                        </Typography>
                    ) : (
                        <List disablePadding>
                            {sortedContacts.map((contact) => (
                                <ListItemButton
                                    key={contact.contact_id}
                                    disabled={isSending}
                                    onClick={() => void handleContactShare(contact.contact_id)}
                                >
                                    <ListItemAvatar>
                                        <Avatar src={contact.contact_avatar ?? ""}>
                                            <Person />
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={getContactDisplayName(contact)}
                                        secondary={contact.contact_number}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </DialogContent>
            </Dialog>
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
        </div>
    );
}
