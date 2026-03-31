"use client";

import { Search } from "@mui/icons-material";
import Person from "@mui/icons-material/Person";
import {
    Avatar,
    Box,
    Button,
    IconButton,
    Tooltip,
    Typography
} from "@mui/material";
import React from "react";
import ChatRoomMoreActionButton from "./chat-room-more-action-button";

export default function ChatRoomHeader() {
    return (
        <Button
            sx={(theme) => ({
                height: 64,
                width: "100%",
                px: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 0,
                boxShadow: "0px 2px 2px rgba(0,0,0,0.08)",
                backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#FFFFFF",
                color: theme.palette.mode === "dark" ? "#FFFFFF" : "#000000",
                "&:hover": {
                    backgroundColor: theme.palette.mode === "dark" ? "#161717" : "#FFFFFF"
                }
            })}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar
                    sx={(theme) => ({
                        width: 40,
                        height: 40,
                        backgroundColor:
                            theme.palette.mode === "dark" ? "#1d1f1f" : "#f7f5f3",
                        border: "1px solid",
                        borderColor:
                            theme.palette.mode === "dark" ? "#404040" : "#d4d4d4",
                        color: theme.palette.mode === "dark" ? "#fff" : "#000",
                    })}
                >
                    <Person />
                </Avatar>
                <Typography
                    variant="body1"
                    sx={{
                        fontWeight: "600",
                        direction: 'ltr'
                    }}
                >
                    +966 55 994 4487
                </Typography>
            </Box>
            <div className="flex flex-row items-center gap-x-2">
                <Tooltip
                    title="Search"
                    placement="bottom"
                    slotProps={{
                        tooltip: {
                            sx: (theme) => ({
                                backgroundColor:
                                    theme.palette.mode === "dark" ? "#ffffff" : "#000000",
                                color: theme.palette.mode === "dark" ? "#000000" : "#ffffff",
                            }),
                        },
                    }}
                >
                    <IconButton
                        size="medium"
                        component="span"
                        sx={(theme) => ({
                            color: theme.palette.mode === "dark" ? "#ffffff" : "#000000"
                        })}
                    >
                        <Search />
                    </IconButton>
                </Tooltip>
                <ChatRoomMoreActionButton
                    chat_type="group"
                />
            </div>
        </Button>
    );
}
