"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const useAuthFlow = (isRTL: boolean) => {
    const router = useRouter();

    const [currentStep, setCurrentStep] = useState<'phoneForm' | 'otpForm' | 'app'>('phoneForm');
    const [phone, setPhone] = useState('');
    const [dialCode, setDialCode] = useState('');
    const [otp, setOtp] = useState('');

    const [loading, setLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const sendOtp = async () => {
        setIsError(false);
        setErrorMsg('');

        try {
            setLoading(true);

            if (!phone) {
                setIsError(true);
                setErrorMsg(isRTL ? 'يرجى إدخال رقم الهاتف.' : 'Please enter your phone number.');
                return;
            }

            const { error } = await authClient.phoneNumber.sendOtp({
                phoneNumber: `${dialCode}${phone}`
            });

            if (error) {
                setIsError(true);
                setErrorMsg(error.message || isRTL ? 'حدث خطأ ما, يرجى إعادة المحاولة.' : 'Something went wrong, please try again.');
                return;
            }

            setCurrentStep('otpForm');
        } catch (error) {
            setIsError(true);
            setErrorMsg(isRTL ? 'حدث خطأ ما فالخادم, اعد المحاولة.' : 'Internal server error, please try again.')
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        setIsError(false);
        setErrorMsg('');

        try {
            setLoading(true);

            if (!otp) {
                setIsError(true);
                setErrorMsg(isRTL ? 'يرجى إدخال رمز التحقق المرسل.' : 'Please enter OTP you received.');
                return;
            }

            const { error } = await authClient.phoneNumber.verify({
                phoneNumber: `${dialCode}${phone}`,
                code: otp,
                disableSession: false,
                updatePhoneNumber: false,
            });

            if (error) {
                setIsError(true);
                setErrorMsg(error.message || isRTL ? 'حدث خطأ ما, يرجى إعادة المحاولة.' : 'Something went wrong, please try again.');
                return;
            }

            router.refresh();
        } catch (error) {
            setIsError(true);
            setErrorMsg(isRTL ? 'حدث خطأ ما فالخادم, اعد المحاولة.' : 'Internal server error, please try again.')
        } finally {
            setLoading(false);
        }
    };

    return {
        currentStep,
        setCurrentStep,
        phone,
        setPhone,
        dialCode,
        setDialCode,
        otp,
        setOtp,
        sendOtp,
        verifyOtp,
        loading,
        isError,
        setIsError,
        errorMsg
    }
};
