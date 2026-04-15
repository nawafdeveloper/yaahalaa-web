"use client";

import { authClient } from "@/lib/auth-client";
import {
    encryptProfileImageFile,
    isSupportedProfileImageType,
    PROFILE_IMAGE_MAX_SIZE_BYTES,
} from "@/lib/profile-image-crypto";
import { ChangeEvent, useEffect, useRef, useState } from "react";

type UseUpdateUserOptions = {
    name: string;
    image?: string | null;
    isRTL: boolean;
};

function getGenericErrorMessage(isRTL: boolean): string {
    return isRTL
        ? "حدث خطأ ما، يرجى إعادة المحاولة."
        : "Something went wrong, please try again.";
}

export const useUpdateUser = ({
    name,
    image,
    isRTL,
}: UseUpdateUserOptions) => {
    const [committedName, setCommittedName] = useState(name);
    const [committedImage, setCommittedImage] = useState(image ?? "");
    const [nameState, setNameState] = useState(name);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);
    const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCommittedName(name);
    }, [name]);

    useEffect(() => {
        setCommittedImage(image ?? "");
    }, [image]);

    useEffect(() => {
        if (!isEditing) {
            setNameState(committedName);
        }
    }, [committedName, isEditing]);

    useEffect(() => {
        if (!selectedProfileImage) {
            setProfileImagePreviewUrl(null);
            return;
        }

        const previewUrl = URL.createObjectURL(selectedProfileImage);
        setProfileImagePreviewUrl(previewUrl);

        return () => {
            URL.revokeObjectURL(previewUrl);
        };
    }, [selectedProfileImage]);

    useEffect(() => {
        if (isEditing) {
            nameInputRef.current?.focus();
        }
    }, [isEditing]);

    const handleStartEditing = () => {
        setIsError(false);
        setErrorMsg("");
        setIsEditing(true);
    };

    const handleOpenProfileImagePicker = () => {
        if (!loading) {
            fileInputRef.current?.click();
        }
    };

    const handleSelectProfileImage = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        if (!isSupportedProfileImageType(file.type)) {
            setIsError(true);
            setErrorMsg(
                isRTL
                    ? "نوع الصورة غير مدعوم."
                    : "Unsupported profile image type.",
            );
            return;
        }

        if (file.size > PROFILE_IMAGE_MAX_SIZE_BYTES) {
            setIsError(true);
            setErrorMsg(
                isRTL
                    ? "الصورة تتجاوز الحد الأقصى 5 ميجابايت."
                    : "Profile image exceeds the 5 MB limit.",
            );
            return;
        }

        setIsError(false);
        setErrorMsg("");
        setSelectedProfileImage(file);
        setIsEditing(true);
    };

    const handleSaveProfile = async () => {
        const trimmedName = nameState.trim();
        const hasNameChanged = trimmedName.length > 0 && trimmedName !== committedName;
        const hasImageChanged = Boolean(selectedProfileImage);

        if (!trimmedName) {
            setIsError(true);
            setErrorMsg(
                isRTL ? "يرجى إدخال الإسم الكامل." : "Please enter your full name.",
            );
            return;
        }

        if (!hasNameChanged && !hasImageChanged) {
            setIsEditing(false);
            return;
        }

        try {
            setLoading(true);
            setIsError(false);
            setErrorMsg("");

            let nextImage = committedImage;

            if (selectedProfileImage) {
                const encryptedUpload = await encryptProfileImageFile(selectedProfileImage);
                const formData = new FormData();

                formData.append(
                    "file",
                    encryptedUpload.encryptedFile,
                    `${selectedProfileImage.name}.bin`,
                );
                formData.append("key", encryptedUpload.key);
                formData.append("iv", encryptedUpload.iv);
                formData.append("mimeType", selectedProfileImage.type);
                formData.append("version", encryptedUpload.version);
                formData.append("originalSize", String(selectedProfileImage.size));

                const uploadResponse = await fetch("/api/profile-image", {
                    method: "POST",
                    body: formData,
                });

                const uploadResult = await uploadResponse.json() as {
                    error?: string;
                    imageUrl?: string;
                };

                if (!uploadResponse.ok || !uploadResult.imageUrl) {
                    throw new Error(uploadResult.error || getGenericErrorMessage(isRTL));
                }

                nextImage = uploadResult.imageUrl;
            }

            const payload: {
                name?: string;
                image?: string;
            } = {};

            if (hasNameChanged) {
                payload.name = trimmedName;
            }

            if (hasImageChanged) {
                payload.image = nextImage;
            }

            const { error: updateUserError } = await authClient.updateUser(payload);

            if (updateUserError) {
                setIsError(true);
                setErrorMsg(updateUserError.message || getGenericErrorMessage(isRTL));
                return;
            }

            if (hasNameChanged) {
                setCommittedName(trimmedName);
            }

            if (hasImageChanged) {
                setCommittedImage(nextImage);
            }

            setSelectedProfileImage(null);
            setIsEditing(false);
        } catch (error) {
            setIsError(true);
            setErrorMsg(
                error instanceof Error && error.message
                    ? error.message
                    : getGenericErrorMessage(isRTL),
            );
        } finally {
            setLoading(false);
        }
    };

    return {
        fileInputRef,
        handleOpenProfileImagePicker,
        handleSaveProfile,
        handleSelectProfileImage,
        handleStartEditing,
        isEditing,
        isError,
        errorMsg,
        loading,
        nameInputRef,
        nameState,
        profileImageSrc: profileImagePreviewUrl ?? committedImage,
        setNameState,
    };
};
