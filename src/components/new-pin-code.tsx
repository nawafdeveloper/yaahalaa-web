"use client";

import { getLocaleFromCookie, isRTLClient } from '@/lib/locale-client';
import { AdminPanelSettingsOutlined, Info } from '@mui/icons-material';
import { Button } from '@mui/material';
import { MuiOtpInput } from 'mui-one-time-password-input';
import Image from 'next/image';
import React, { useState } from 'react';
import { useCrypto } from '@/hooks/use-crypto';
import { authClient } from '@/lib/auth-client';

export default function NewPinCode() {
    const locale = getLocaleFromCookie();
    const isRTL = locale ? isRTLClient(locale) : false;
    const { register, state } = useCrypto();

    const [pin, setPin] = useState('');
    const [isError, setIsError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        setLoading(true);
        setIsError(false);
        setErrorMsg('');

        try {
            // Register the PIN with crypto
            await register(pin);

            // Update user to mark as not new user anymore
            await authClient.updateUser({
                isNewUser: false,
            });

            // Refresh the page
            window.location.reload();
        } catch {
            setIsError(true);
            setErrorMsg(isRTL ? 'فشل تسجيل الرقم السري' : 'Failed to register passcode');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (newValue: string) => {
        setPin(newValue);
        setIsError(false);
        setErrorMsg('');
    };

    return (
        <div className='flex flex-col items-center justify-center w-full h-screen p-4'>
            <div className='flex flex-col h-full max-h-1/2 justify-between w-full md:max-w-sm md:mx-auto'>
                <div className='flex flex-col items-center justify-center gap-y-4 md:gap-y-8 w-full'>
                    <Image
                        src={'/halabaak-logo.svg'}
                        alt="HalaBaak Corp.©"
                        width={200}
                        height={200}
                        className="w-auto h-7 object-contain"
                    />
                    <span className='flex flex-col gap-y-1'>
                        <h1 className='text-4xl text-center'>{isRTL ? 'أنشئ رقمك السري' : 'Create Passcode'}</h1>
                        <p className='text-lg text-center text-gray-500'>{isRTL ? 'الرقم السري الخاص بحسابك' : 'Passcode for your account'}</p>
                    </span>
                    <MuiOtpInput
                        value={pin}
                        onChange={handleChange}
                        length={6}
                        autoFocus
                        TextFieldsProps={{
                            type: "password",
                        }}
                        sx={(theme) => ({
                            "& .MuiOtpInput-TextField": {
                                borderRadius: 3,
                                backgroundColor: theme.palette.mode === "dark" ? "#2B2C2C" : "#E8E7E5",
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderRadius: 3,
                                    border: "none"
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor: "#25D366",
                                    backgroundColor: theme.palette.mode === "dark" ? "#343535" : "#E1DFDD",
                                },
                                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                    borderColor: "#25D366",
                                    borderWidth: 2,
                                },
                                input: {
                                    textAlign: "center",
                                },
                            },
                        })}
                    />
                </div>
                {isError && (
                    <span className='flex flex-row items-center gap-x-2 mt-1 mb-5 text-sm text-gray-500'>
                        <Info fontSize='small' />
                        <p>{errorMsg}</p>
                    </span>
                )}
                <div className='flex flex-col gap-y-2 w-full justify-center items-center'>
                    <Button
                        onClick={handleRegister}
                        disabled={pin.length < 6 || loading || state.status === "loading"}
                        variant="outlined"
                        sx={{
                            borderRadius: 99,
                            paddingY: "10px",
                            border: "none",
                            backgroundColor: "#25D366",
                            textTransform: "none",
                            color: "#1C1E21",
                            "&:hover": {
                                backgroundColor: "#1E9A4D",
                            },
                            "&.Mui-disabled": {
                                backgroundColor: "#25D36660",
                                color: "#1C1E2180",
                                border: "none",
                            },
                        }}
                        fullWidth
                    >
                        {loading || state.status === "loading" ? (
                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <g>
                                    <rect x="11" y="1" width="2" height="5" opacity=".14" />
                                    <rect x="11" y="1" width="2" height="5" transform="rotate(30 12 12)" opacity=".29" />
                                    <rect x="11" y="1" width="2" height="5" transform="rotate(60 12 12)" opacity=".43" />
                                    <rect x="11" y="1" width="2" height="5" transform="rotate(90 12 12)" opacity=".57" />
                                    <rect x="11" y="1" width="2" height="5" transform="rotate(120 12 12)" opacity=".71" />
                                    <rect x="11" y="1" width="2" height="5" transform="rotate(150 12 12)" opacity=".86" />
                                    <rect x="11" y="1" width="2" height="5" transform="rotate(180 12 12)" />
                                    <animateTransform attributeName="transform" type="rotate" calcMode="discrete" dur="0.75s" values="0 12 12;30 12 12;60 12 12;90 12 12;120 12 12;150 12 12;180 12 12;210 12 12;240 12 12;270 12 12;300 12 12;330 12 12;360 12 12" repeatCount="indefinite" />
                                </g>
                            </svg>
                        ) : (
                            <>
                                {isRTL ? 'إنشاء' : 'Create'}
                            </>
                        )}
                    </Button>
                    <span className='flex flex-row items-start gap-x-1 text-sm text-gray-500'>
                        <AdminPanelSettingsOutlined fontSize="inherit" className='mt-0.5' />
                        <p>{isRTL ? 'معلوماتك محمية وفقًا لسياسة الخصوصية الخاصة بنا.' : 'Your information is protected in accordance with our Privacy Policy.'}</p>
                    </span>
                </div>
            </div>
        </div>
    );
}
