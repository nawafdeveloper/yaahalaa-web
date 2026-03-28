"use client";

import { groupContactsByLetter } from "@/lib/contact-organizer";
import { contacts } from "@/mocks/contact-items";
import { CloseOutlined, GroupAdd, PersonAdd, SearchOutlined } from "@mui/icons-material";
import { Avatar, List, ListItem, ListItemAvatar, ListItemButton, ListItemText, Typography } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { useRef, useState } from "react";
import CreateChatHeaderLargeSidebar from "./create-chat-header-large-sidebar";

export default function CreateChatSearchLargeSidebar() {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const grouped = groupContactsByLetter(contacts);

    const handleClear = () => {
        setValue("");
        inputRef.current?.blur();
    };

    return (
        <div className="flex flex-col gap-y-3 h-full">
            <CreateChatHeaderLargeSidebar />
            <TextField
                hiddenLabel
                id="filled-search-bar"
                variant="filled"
                size="small"
                placeholder="Search name or number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputRef={inputRef}
                sx={(theme) => ({
                    "& .MuiFilledInput-root": {
                        borderRadius: 8,
                        "&.Mui-focused": {
                            outline: "2px solid #25D366",
                            backgroundColor: theme.palette.mode === "dark" ? "rgba(28,30,33,0)" : "#ffffff",
                        },
                    },
                    marginX: "20px"
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
                    endAdornment: value ? (
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
                                backgroundColor: theme.palette.mode === "dark" ? "#242626" : "#f7f5f3",
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
                            <ListItemText primary="New group" />
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
                                backgroundColor: theme.palette.mode === "dark" ? "#242626" : "#f7f5f3",
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
                                    <PersonAdd sx={{ width: "30px", height: "30px" }} />
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText primary="New contact" />
                        </ListItem>
                    </ListItemButton>
                </List>
                <List>
                    {grouped.map((group) => (
                        <div key={group.letter}>
                            <Typography
                                sx={{
                                    px: 2,
                                    py: 0.5,
                                    paddingY: 4,
                                    fontWeight: 600,
                                    color: (theme) => (theme.palette.mode === "dark" ? "#A5A5A5" : "#636261"),
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
                                        color: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                                        "&:hover": {
                                            backgroundColor: theme.palette.mode === "dark" ? "#242626" : "#f7f5f3",
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
                                                    color: theme.palette.mode === "dark" ? "#1C1E21" : "#FFFFFF",
                                                })}
                                            >
                                                {!contact.contact_avatar &&
                                                    contact.contact_first_name?.[0]?.toUpperCase()}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={`${contact.contact_first_name || ""} ${contact.contact_second_name || ""}`.trim() || contact.contact_number}
                                            secondary={contact.contact_bio ? contact.contact_bio : null}
                                        />
                                    </ListItem>
                                </ListItemButton>
                            ))}
                        </div>
                    ))}
                </List>
            </div>
        </div>
    );
}
