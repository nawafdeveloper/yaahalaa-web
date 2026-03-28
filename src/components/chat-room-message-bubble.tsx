"use client";

import { generateVideoThumbnailFromUrl } from '@/lib/generate-thumbnail';
import { Message } from '@/types/messages.type';
import { CheckCircle, Mic, PauseRounded, Person, PlayArrowRounded, ShortcutOutlined, VideocamRounded } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Checkbox from '@mui/material/Checkbox';
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react'
import Image from 'next/image';
import { motion } from 'framer-motion';
import { getFileExtension, getFileSize } from '@/lib/files';
import AudioPlayer, { RHAP_UI } from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import Link from 'next/link';
import ChatRoomActionBubble from './chat-room-action-bubble';
import ChatRoomReactionButton from './chat-room-reaction-button';
import ChatRoomForwardButton from './chat-room-forward-button';
import useMediaPreviewStore from '@/store/media-preview-store';
import { Avatar, Button } from '@mui/material';
import PollComponent from './chat-poll-item';
import { convertToPollWithVotes } from '@/utils/convert-to-poll-with-votes';

type Props = {
    message: Message;
    isSelectMode: boolean;
    selectedMessages: string[];
    setSelectedMessages: (value: string[]) => void;
    isFirstInGroup?: boolean;
}

export default function ChatRoomMessageBubble({
    message,
    isSelectMode,
    selectedMessages,
    setSelectedMessages,
    isFirstInGroup = true,
}: Props) {
    const { openPreview } = useMediaPreviewStore();

    const [thumbnail, setThumbnail] = useState('');
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isListEnter, setIsListEnter] = useState(false);
    const [fileSize, setFileSize] = useState(0);
    const [isBubbleEnter, setIsBubbleEnter] = useState(false);

    const mediaTypes = ['photo', 'video'] as const;

    const mediaPrev = mediaTypes.includes(
        message.attached_media as typeof mediaTypes[number]
    );

    const handleToggle = (value: string) => () => {
        const currentIndex = selectedMessages.indexOf(value);
        const newChecked = [...selectedMessages];

        if (currentIndex === -1) {
            newChecked.push(value);
        } else {
            newChecked.splice(currentIndex, 1);
        }

        setSelectedMessages(newChecked);
    };

    const getThumbnail = async () => {
        try {
            setImageLoaded(false);
            const thumbnailBlob = await generateVideoThumbnailFromUrl(message.media_url || '');
            const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
            setThumbnail(thumbnailUrl);
        } catch (error) {
            console.log(error);
        } finally {
            setImageLoaded(true);
        }
    };

    const filePreperation = async () => {
        try {
            if (message.attached_media !== 'file') return null;
            if (message.media_url) {
                const size = await getFileSize(message.media_url);
                setFileSize(size || 0);
            }
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        getThumbnail();
        filePreperation();
    }, []);

    const me = message.sender_user_id === 'user_456';
    const isSender = me;

    const TAIL_WIDTH = 8;

    const getHue = (userId: string): number => {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 360;
    };

    return (
        <ListItem disablePadding>
            <ListItemButton
                dir='ltr'
                onClick={isSelectMode ? handleToggle(message.message_id) : () => { }}
                dense={false}
                disableRipple={!isSelectMode}
                disableTouchRipple={!isSelectMode}
                onMouseEnter={() => setIsListEnter(true)}
                onMouseLeave={() => setIsListEnter(false)}
                sx={{
                    cursor: isSelectMode ? "pointer" : "default",
                    ...(!isSelectMode && {
                        "&:hover": { backgroundColor: "transparent" },
                    }),
                    paddingTop: isFirstInGroup ? undefined : '2px',
                    paddingBottom: isFirstInGroup ? undefined : '2px',
                }}
            >
                <div className={`flex flex-row items-center w-full md:max-w-7xl md:mx-auto ${!isSender ? 'gap-x-3' : ''}`}>
                    {isSelectMode && (
                        <ListItemIcon>
                            <Checkbox
                                edge="start"
                                checked={selectedMessages.includes(message.message_id)}
                                tabIndex={-1}
                                disableRipple
                                sx={{ '&.Mui-checked': { color: "#25D366" } }}
                            />
                        </ListItemIcon>
                    )}
                    {!isSelectMode && isSender && (
                        <div className="flex flex-row items-center gap-x-1 mr-1 ml-auto">
                            <ChatRoomForwardButton />
                            {isListEnter && <ChatRoomReactionButton />}
                        </div>
                    )}
                    <div className={`flex flex-row items-start`}>
                        {!isSender && (
                            <div style={{ width: 34, flexShrink: 0, alignSelf: 'flex-start', marginRight: 4 }}>
                                {isFirstInGroup ? (
                                    <Avatar
                                        sx={(theme) => {
                                            const hue = getHue(message.sender_user_id);
                                            const mode = theme.palette.mode;

                                            if (mode === 'dark') {
                                                return {
                                                    width: 34,
                                                    height: 34,
                                                    backgroundColor: `hsl(${hue}, 70%, 20%)`, // dark background
                                                    color: `hsl(${hue}, 80%, 65%)`,          // bright icon
                                                    fontSize: 16,
                                                };
                                            } else {
                                                return {
                                                    width: 34,
                                                    height: 34,
                                                    backgroundColor: `hsl(${hue}, 70%, 85%)`, // light background
                                                    color: `hsl(${hue}, 80%, 30%)`,          // dark icon
                                                    fontSize: 16,
                                                };
                                            }
                                        }}
                                        src={""}
                                        alt={message.sender_user_id}
                                    >
                                        <Person fontSize="small" />
                                    </Avatar>
                                ) : (
                                    <div style={{ width: 34, height: 34 }} />
                                )}
                            </div>
                        )}
                        {!isSender && (
                            isFirstInGroup ? (
                                <span className='text-white dark:text-[#222424]' aria-hidden="true" data-icon="tail-in">
                                    <svg viewBox="0 0 8 13" height="13" width={TAIL_WIDTH} preserveAspectRatio="xMidYMid meet" version="1.1" x="0px" y="0px" enableBackground="new 0 0 8 13">
                                        <title>tail-in</title>
                                        <path opacity="0.13" fill="currentColor" d="M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z"></path>
                                        <path fill="currentColor" d="M1.533,2.568L8,11.193V0L2.812,0C1.042,0,0.474,1.156,1.533,2.568z"></path>
                                    </svg>
                                </span>
                            ) : (
                                <div style={{ width: TAIL_WIDTH, flexShrink: 0 }} />
                            )
                        )}

                        <Card
                            sx={(theme) => ({
                                maxWidth: { lg: mediaPrev ? 250 : '100%', xs: mediaPrev ? 200 : '100%' },
                                padding: "3px",
                                borderTopRightRadius: isSender ? (isFirstInGroup ? 0 : 7) : 7,
                                borderBottomRightRadius: 7,
                                borderBottomLeftRadius: 7,
                                borderTopLeftRadius: isSender ? 7 : (isFirstInGroup ? 0 : 7),
                                position: 'relative',
                                overflow: 'visible',
                                boxShadow: "0px 2px 0px rgba(0,0,0,0.09)",
                                backgroundColor: isSender
                                    ? theme.palette.mode === "dark" ? "#182A1F" : "#DCF8C6"
                                    : theme.palette.mode === "dark" ? "rgba(22,24,24,1)" : "#FFFFFF",
                            })}
                            onMouseEnter={() => !isSelectMode && setIsBubbleEnter(true)}
                            onMouseLeave={() => setIsBubbleEnter(false)}
                        >
                            <CardHeader
                                action={isBubbleEnter && !isSelectMode && (
                                    <motion.div
                                        initial={{ x: 16, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: 16, opacity: 0 }}
                                        transition={{ duration: 0.09, ease: "easeOut" }}
                                    >
                                        <ChatRoomActionBubble />
                                    </motion.div>
                                )}
                                sx={{
                                    position: 'absolute',
                                    zIndex: 10,
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    paddingY: "6px",
                                    paddingX: "12px",
                                    m: "3px",
                                    borderTopRightRadius: 5,
                                    transition: 'ease-in-out',
                                    pointerEvents: 'none'
                                }}
                            />
                            {!isSender && (
                                <Button
                                    variant="text"
                                    size="small"
                                    className="pl-2 font-semibold! text-xs!"
                                    sx={(theme) => {
                                        const hue = getHue(message.sender_user_id);
                                        const mode = theme.palette.mode;

                                        return {
                                            color: mode === 'dark'
                                                ? `hsl(${hue}, 80%, 65%)`
                                                : `hsl(${hue}, 80%, 30%)`,
                                            textTransform: 'none',
                                            minWidth: 'auto',
                                            padding: 0,
                                            paddingLeft: 1,
                                            '&:hover': {
                                                backgroundColor: 'transparent',
                                                textDecoration: 'underline',
                                            },
                                        };
                                    }}
                                >
                                    {message.sender_user_id}
                                </Button>
                            )}
                            {message.is_forward_message && (
                                <span className='flex flex-row items-center gap-x-2 text-gray-300 dark:text-gray-400 text-xs p-1'>
                                    <ShortcutOutlined fontSize='inherit' />
                                    <p className='italic'>Forwarded</p>
                                </span>
                            )}
                            {message.open_graph_data && (
                                <Link target="_blank" rel="noopener noreferrer" href={message.open_graph_data.og_url || '/'} className='flex cursor-pointer justify-start items-start flex-col gap-x-3 p-2 rounded-lg bg-[#f7f5f3] dark:bg-[#1a1b1b] mb-1 text-sm'>
                                    <p className='font-semibold'>{message.open_graph_data.og_title}</p>
                                    <p className='text-gray-500 dark:text-gray-300'>{message.open_graph_data.og_description}</p>
                                    <p className='text-gray-700 dark:text-gray-400 text-xs'>{message.open_graph_data.og_url}</p>
                                </Link>
                            )}
                            {message.poll && (
                                <PollComponent
                                    poll={convertToPollWithVotes(message.poll)}
                                    onVote={(pollId, selectedOptionIds) => {
                                        // Send vote to your backend, then update the message's poll data
                                        // e.g., call an API and then refetch or update local state
                                    }}
                                    isSender={isSender}
                                />
                            )}
                            {message.attached_media === 'voice' && (
                                <div className='flex flex-row items-center gap-x-1 p-2'>
                                    <div className='relative'>
                                        <div className='w-14 h-14 rounded-full flex justify-center items-center text-gray-300 bg-[#f7f5f3] dark:bg-[#1a1b1b]'>
                                            <Person fontSize="large" />
                                        </div>
                                        <Mic fontSize="small" className='text-[#25D366] absolute -right-1 -bottom-1' />
                                    </div>
                                    <div className='flex flex-row items-center gap-x-2 min-w-64 max-w-64'>
                                        <AudioPlayer
                                            src="https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Sevish_-__nbsp_.mp3"
                                            showJumpControls={false}
                                            customAdditionalControls={[]}
                                            layout='horizontal-reverse'
                                            customControlsSection={[
                                                RHAP_UI.MAIN_CONTROLS,
                                                RHAP_UI.CURRENT_TIME,
                                                RHAP_UI.PROGRESS_BAR,
                                            ]}
                                            customIcons={{
                                                play: <PlayArrowRounded sx={(theme) => ({ color: theme.palette.mode === 'dark' ? 'white' : 'black', marginBottom: 0.5 })} />,
                                                pause: <PauseRounded sx={(theme) => ({ color: theme.palette.mode === 'dark' ? 'white' : 'black', marginBottom: 0.5 })} />
                                            }}
                                            customProgressBarSection={[]}
                                        />
                                    </div>
                                </div>
                            )}
                            {message.attached_media === 'file' && (
                                <button className='flex flex-row cursor-pointer items-center gap-x-3 p-4 rounded-lg bg-[#f7f5f3] dark:bg-[#1a1b1b] mb-1 w-full'>
                                    <Image
                                        src={'/file.svg'}
                                        alt='File'
                                        width={500}
                                        height={500}
                                        className='w-auto h-8 object-contain'
                                    />
                                    <span className='flex flex-col leading-tight text-start'>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                display: '-webkit-box',
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            This is file name
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'gray' }}>
                                            {getFileExtension(message.media_url || '')} • {fileSize}
                                        </Typography>
                                    </span>
                                </button>
                            )}
                            {mediaPrev && (
                                <button
                                    onClick={() => {
                                        if (message.attached_media === 'photo' || message.attached_media === 'video') {
                                            openPreview(message.attached_media, message.media_url || '', message.sender_user_id, message.created_at.toLocaleDateString());
                                        }
                                    }}
                                    className='overflow-hidden cursor-pointer relative'>
                                    {message.attached_media === 'video' && (
                                        <div className='absolute left-0 right-0 top-0 bottom-0 z-5 h-full w-full flex justify-center items-center'>
                                            <div className='w-12 h-12 rounded-full bg-black/30 justify-center items-center flex text-white'>
                                                <PlayArrowRounded fontSize="large" />
                                            </div>
                                            <div className='absolute left-2 bottom-2 flex flex-row items-center gap-x-1 text-xs text-white'>
                                                <VideocamRounded fontSize="small" />
                                                <p className='text-gray-200'>2:33</p>
                                            </div>
                                        </div>
                                    )}
                                    <LazyLoadImage
                                        alt={message.message_text_content || ''}
                                        height={'auto'}
                                        effect="blur"
                                        src={(message.attached_media === 'photo' ? message.media_url : message.attached_media === 'video' ? message.video_thumbnail : thumbnail) || ''}
                                        width={'100%'}
                                        wrapperProps={{ style: { transitionDelay: "1s" } }}
                                        style={{ borderRadius: 4, overflow: 'hidden' }}
                                    />
                                </button>
                            )}
                            {message.attached_media === 'contact' && (
                                <button className='flex flex-row w-full cursor-pointer items-center gap-x-3 p-3 rounded-lg bg-[#f7f5f3] dark:bg-[#1a1b1b]'>
                                    <div className='relative shrink-0 w-12 h-12 rounded-full overflow-hidden'>
                                        <Avatar
                                            sx={(theme) => ({
                                                width: 45,
                                                height: 45,
                                                backgroundColor: theme.palette.mode === "dark" ? "rgba(36,40,40,1)" : "#FFFFFF",
                                                color: theme.palette.mode === "dark" ? "#f7f5f3" : "#1a1b1b",
                                            })}
                                            src={message.contact?.contact_image || ""}
                                            alt={`${message.contact?.contact_name || 'Contact'} Avatar`}
                                        >
                                            <Person />
                                        </Avatar>
                                    </div>
                                    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                        {message.contact?.contact_name ? (
                                            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                                                {message.contact.contact_name}
                                            </Typography>
                                        ) : message.sender_user_id ? (
                                            <Typography variant="body2">{message.sender_user_id}</Typography>
                                        ) : null}
                                    </Box>
                                </button>
                            )}
                            <CardContent
                                sx={{
                                    px: '8px',
                                    py: message.attached_media === 'voice' ? '0px' : '8px',
                                    paddingBottom: message.attached_media === 'voice' ? '0px !important' : '8px !important',
                                    position: message.attached_media === 'voice' ? 'absolute' : 'relative',
                                    bottom: message.attached_media === 'voice' ? 3 : undefined,
                                    right: message.attached_media === 'voice' ? 3 : undefined
                                }}
                            >
                                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'end', justifyContent: 'space-between', width: '100%', gap: 3, position: 'relative' }}>
                                    <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                        <Typography
                                            variant="body2"
                                            sx={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
                                        >
                                            {message.message_text_content}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: 'gray' }}>
                                            {message.created_at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                        {isSender && (
                            isFirstInGroup ? (
                                <span className='text-[#DCF8C6] dark:text-[#24352A] transform scale-x-[-1]' aria-hidden="true" data-icon="tail-in">
                                    <svg viewBox="0 0 8 13" height="13" width={TAIL_WIDTH} preserveAspectRatio="xMidYMid meet" version="1.1" x="0px" y="0px" enableBackground="new 0 0 8 13">
                                        <title>tail-in</title>
                                        <path opacity="0.13" fill="currentColor" d="M1.533,3.568L8,12.193V1H2.812 C1.042,1,0.474,2.156,1.533,3.568z"></path>
                                        <path fill="currentColor" d="M1.533,2.568L8,11.193V0L2.812,0C1.042,0,0.474,1.156,1.533,2.568z"></path>
                                    </svg>
                                </span>
                            ) : (
                                <div style={{ width: TAIL_WIDTH, flexShrink: 0 }} />
                            )
                        )}
                    </div>
                    {!isSelectMode && !isSender && (
                        <div className="flex flex-row items-center gap-x-1">
                            <ChatRoomForwardButton />
                            {isListEnter && <ChatRoomReactionButton />}
                        </div>
                    )}
                </div>
            </ListItemButton>
        </ListItem>
    );
}