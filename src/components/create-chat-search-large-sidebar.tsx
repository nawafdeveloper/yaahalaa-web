"use client";

import { useCryptoKeys } from "@/context/crypto";
import { decryptStoredContact, matchesContactSearch } from "@/lib/contact-crypto";
import { groupContactsByLetter } from "@/lib/contact-organizer";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import { useSubsidebarStore } from "@/store/use-active-subsidebar-store";
import type { Contact, StoredContactRecord } from "@/types/contacts.type";
import {
    CloseOutlined,
    GroupAdd,
    PersonAdd,
    SearchOutlined,
} from "@mui/icons-material";
import {
    Avatar,
    CircularProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    Typography,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { useEffect, useRef, useState } from "react";
import CreateChatHeaderLargeSidebar from "./create-chat-header-large-sidebar";

export default function CreateChatSearchLargeSidebar() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { isReady } = useCryptoKeys();
    const { setActiveSubsideBar } = useSubsidebarStore();

    const [value, setValue] = useState("");
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [contactsError, setContactsError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredContacts = value.trim()
        ? contacts.filter((contact) => matchesContactSearch(contact, value))
        : contacts;
    const groupedContacts = groupContactsByLetter(filteredContacts);

    useEffect(() => {
        if (!isReady) {
            return;
        }

        let isActive = true;

        const loadContacts = async () => {
            try {
                setIsLoadingContacts(true);
                setContactsError("");

                const response = await fetch("/api/contacts", {
                    cache: "no-store",
                });

                if (!response.ok) {
                    throw new Error("Failed to load contacts.");
                }

                const payload = (await response.json()) as {
                    contacts: StoredContactRecord[];
                };
                const decryptedContacts = await Promise.all(
                    payload.contacts.map(async (contactRecord) => {
                        try {
                            return await decryptStoredContact(contactRecord);
                        } catch {
                            return null;
                        }
                    })
                );

                if (!isActive) {
                    return;
                }

                setContacts(
                    decryptedContacts.filter(
                        (contact): contact is Contact => contact !== null
                    )
                );
            } catch (error) {
                if (!isActive) {
                    return;
                }

                setContactsError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load contacts."
                );
            } finally {
                if (isActive) {
                    setIsLoadingContacts(false);
                }
            }
        };

        const handleContactsChanged = () => {
            void loadContacts();
        };

        void loadContacts();
        window.addEventListener("contacts:changed", handleContactsChanged);

        return () => {
            isActive = false;
            window.removeEventListener("contacts:changed", handleContactsChanged);
        };
    }, [isReady]);

    const handleClear = () => {
        setValue("");
        inputRef.current?.blur();
    };

    return (
        <div className="flex h-full flex-col gap-y-3">
            <CreateChatHeaderLargeSidebar />
            <TextField
                hiddenLabel
                id="filled-search-bar"
                variant="filled"
                size="small"
                placeholder={
                    isRTL ? "ط¥ط¨ط­ط« ط¹ظ† ط¥ط³ظ… ط£ظˆ ط±ظ‚ظ…" : "Search name or number"
                }
                value={value}
                onChange={(event) => setValue(event.target.value)}
                inputRef={inputRef}
                sx={(theme) => ({
                    "& .MuiFilledInput-root": {
                        borderRadius: 8,
                        "&.Mui-focused": {
                            outline: "2px solid #25D366",
                            backgroundColor:
                                theme.palette.mode === "dark"
                                    ? "rgba(28,30,33,0)"
                                    : "#ffffff",
                        },
                    },
                    marginX: "20px",
                })}
                InputProps={{
                    disableUnderline: true,
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchOutlined
                                sx={{
                                    color: (theme) =>
                                        theme.palette.mode === "dark"
                                            ? "#A5A5A5"
                                            : "#636261",
                                    width: 20,
                                    height: 20,
                                }}
                            />
                        </InputAdornment>
                    ),
                    endAdornment: value ? (
                        <InputAdornment position="end">
                            <IconButton onClick={handleClear} size="small">
                                <CloseOutlined
                                    sx={{
                                        color: (theme) =>
                                            theme.palette.mode === "dark"
                                                ? "#A5A5A5"
                                                : "#636261",
                                        width: 18,
                                        height: 18,
                                    }}
                                />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                }}
            />
            <div className="flex flex-col overflow-y-auto px-5">
                <List>
                    <ListItemButton
                        sx={(theme) => ({
                            width: "100%",
                            borderRadius: 3,
                            padding: 0,
                            marginY: "2px",
                            backgroundColor: "transparent",
                            textTransform: "inherit",
                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                            "&:hover": {
                                backgroundColor:
                                    theme.palette.mode === "dark"
                                        ? "#242626"
                                        : "#f7f5f3",
                            },
                        })}
                    >
                        <ListItem sx={{ paddingY: 1, paddingX: 2 }}>
                            <ListItemAvatar>
                                <Avatar
                                    sx={(theme) => ({
                                        width: 50,
                                        height: 50,
                                        marginRight: 2,
                                        backgroundColor: "#25D366",
                                        color: theme.palette.mode === "dark" ? "#1C1E21" : "#FFFFFF",
                                    })}
                                >
                                    <GroupAdd sx={{ width: "30px", height: "30px" }} />
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={isRTL ? "ظ…ط¬ظ…ظˆط¹ط© ط¬ط¯ظٹط¯ط©" : "New group"}
                            />
                        </ListItem>
                    </ListItemButton>

                    <ListItemButton
                        sx={(theme) => ({
                            width: "100%",
                            borderRadius: 3,
                            padding: 0,
                            marginY: "2px",
                            backgroundColor: "transparent",
                            textTransform: "inherit",
                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                            "&:hover": {
                                backgroundColor:
                                    theme.palette.mode === "dark"
                                        ? "#242626"
                                        : "#f7f5f3",
                            },
                        })}
                        onClick={() => setActiveSubsideBar("new-contact")}
                    >
                        <ListItem sx={{ paddingY: 1, paddingX: 2 }}>
                            <ListItemAvatar>
                                <Avatar
                                    sx={(theme) => ({
                                        width: 50,
                                        height: 50,
                                        marginRight: 2,
                                        backgroundColor: "#25D366",
                                        color: theme.palette.mode === "dark" ? "#1C1E21" : "#FFFFFF",
                                    })}
                                >
                                    <PersonAdd sx={{ width: "30px", height: "30px" }} />
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={isRTL ? "ط¬ظ‡ط© ط¥طھطµط§ظ„" : "New contact"}
                            />
                        </ListItem>
                    </ListItemButton>
                </List>

                {isLoadingContacts || !isReady ? (
                    <div className="flex items-center justify-center py-8">
                        <CircularProgress size={22} sx={{ color: "#25D366" }} />
                    </div>
                ) : contactsError ? (
                    <Typography
                        sx={{
                            px: 2,
                            py: 3,
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#d7d7d7" : "#555555",
                        }}
                    >
                        {contactsError}
                    </Typography>
                ) : groupedContacts.length === 0 ? (
                    <Typography
                        sx={{
                            px: 2,
                            py: 3,
                            color: (theme) =>
                                theme.palette.mode === "dark" ? "#A5A5A5" : "#636261",
                        }}
                    >
                        {value.trim()
                            ? isRTL
                                ? "لا توجد نتائج مطابقة."
                                : "No matching contacts found."
                            : isRTL
                              ? "لا توجد جهات اتصال بعد."
                              : "No contacts yet."}
                    </Typography>
                ) : (
                    <List>
                        {groupedContacts.map((group) => (
                            <div key={group.letter}>
                                <Typography
                                    sx={{
                                        px: 2,
                                        py: 0.5,
                                        paddingY: 4,
                                        fontWeight: 600,
                                        color: (theme) =>
                                            theme.palette.mode === "dark"
                                                ? "#A5A5A5"
                                                : "#636261",
                                        fontSize: 14,
                                    }}
                                >
                                    {group.letter}
                                </Typography>
                                {group.contacts.map((contact) => (
                                    <ListItemButton
                                        key={contact.contact_id}
                                        sx={(theme) => ({
                                            width: "100%",
                                            borderRadius: 3,
                                            padding: 0,
                                            marginY: "2px",
                                            backgroundColor: "transparent",
                                            textTransform: "inherit",
                                            color:
                                                theme.palette.mode === "dark"
                                                    ? "#ffffff"
                                                    : "#000000",
                                            "&:hover": {
                                                backgroundColor:
                                                    theme.palette.mode === "dark"
                                                        ? "#242626"
                                                        : "#f7f5f3",
                                            },
                                        })}
                                    >
                                        <ListItem sx={{ paddingY: 1, paddingX: 2 }}>
                                            <ListItemAvatar>
                                                <Avatar
                                                    src={contact.contact_avatar}
                                                    sx={(theme) => ({
                                                        width: 50,
                                                        height: 50,
                                                        marginRight: 2,
                                                        backgroundColor: "#25D366",
                                                        color:
                                                            theme.palette.mode === "dark"
                                                                ? "#1C1E21"
                                                                : "#FFFFFF",
                                                    })}
                                                >
                                                    {!contact.contact_avatar &&
                                                        (
                                                            contact.contact_first_name?.[0] ||
                                                            contact.contact_second_name?.[0] ||
                                                            contact.contact_number[0]
                                                        )?.toUpperCase()}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    `${contact.contact_first_name || ""} ${
                                                        contact.contact_second_name || ""
                                                    }`.trim() || contact.contact_number
                                                }
                                                secondary={contact.contact_number}
                                            />
                                        </ListItem>
                                    </ListItemButton>
                                ))}
                            </div>
                        ))}
                    </List>
                )}
            </div>
        </div>
    );
}
