"use client";

import { authClient } from "@/lib/auth-client";
import { uploadEncryptedProfileImage } from "@/lib/profile-image-upload";
import { decryptText, encryptText } from "@/lib/text-encryption";
import { ChangeEvent, useEffect, useRef, useState } from "react";

const PROFILE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const ABOUT_MAX_LENGTH = 99;
const PROFILE_IMAGE_ACCEPTED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
] as const;

function isSupportedProfileImageType(mimeType: string): boolean {
    return PROFILE_IMAGE_ACCEPTED_MIME_TYPES.includes(
        mimeType as (typeof PROFILE_IMAGE_ACCEPTED_MIME_TYPES)[number],
    );
}

type UseUpdateUserOptions = {
    name: string;
    image?: string | null;
    aboutCiphertext?: string | null;
    aboutEncryptedAesKey?: string | null;
    aboutIv?: string | null;
    isRTL: boolean;
};

function getGenericErrorMessage(isRTL: boolean): string {
    return isRTL
        ? "ط­ط¯ط« ط®ط·ط£ ظ…ط§طŒ ظٹط±ط¬ظ‰ ط¥ط¹ط§ط¯ط© ط§ظ„ظ…ط­ط§ظˆظ„ط©."
        : "Something went wrong, please try again.";
}

export const useUpdateUser = ({
    name,
    image,
    aboutCiphertext,
    aboutEncryptedAesKey,
    aboutIv,
    isRTL,
}: UseUpdateUserOptions) => {
    const [committedName, setCommittedName] = useState(name);
    const [committedImage, setCommittedImage] = useState(image ?? "");
    const [committedAbout, setCommittedAbout] = useState("");
    const [nameState, setNameState] = useState(name);
    const [aboutState, setAboutState] = useState("");
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
            setAboutState(committedAbout);
        }
    }, [committedAbout, committedName, isEditing]);

    useEffect(() => {
        let isActive = true;

        const loadAbout = async () => {
            if (!aboutCiphertext || !aboutEncryptedAesKey || !aboutIv) {
                if (!isActive) {
                    return;
                }

                setCommittedAbout("");
                if (!isEditing) {
                    setAboutState("");
                }
                return;
            }

            try {
                const decryptedAbout = await decryptText({
                    ciphertext: aboutCiphertext,
                    encryptedAesKey: aboutEncryptedAesKey,
                    iv: aboutIv,
                });

                if (!isActive) {
                    return;
                }

                setCommittedAbout(decryptedAbout);
                if (!isEditing) {
                    setAboutState(decryptedAbout);
                }
            } catch {
                if (!isActive) {
                    return;
                }

                setCommittedAbout("");
                if (!isEditing) {
                    setAboutState("");
                }
            }
        };

        void loadAbout();

        return () => {
            isActive = false;
        };
    }, [aboutCiphertext, aboutEncryptedAesKey, aboutIv, isEditing]);

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
                    ? "ظ†ظˆط¹ ط§ظ„طµظˆط±ط© ط؛ظٹط± ظ…ط¯ط¹ظˆظ…."
                    : "Unsupported profile image type.",
            );
            return;
        }

        if (file.size > PROFILE_IMAGE_MAX_SIZE_BYTES) {
            setIsError(true);
            setErrorMsg(
                isRTL
                    ? "ط§ظ„طµظˆط±ط© طھطھط¬ط§ظˆط² ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ 5 ظ…ظٹط¬ط§ط¨ط§ظٹطھ."
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
        const trimmedAbout = aboutState.trim();
        const hasNameChanged = trimmedName.length > 0 && trimmedName !== committedName;
        const hasAboutChanged = trimmedAbout !== committedAbout;
        const hasImageChanged = Boolean(selectedProfileImage);

        if (!trimmedName) {
            setIsError(true);
            setErrorMsg(
                isRTL ? "ظٹط±ط¬ظ‰ ط¥ط¯ط®ط§ظ„ ط§ظ„ط¥ط³ظ… ط§ظ„ظƒط§ظ…ظ„." : "Please enter your full name.",
            );
            return;
        }

        if (trimmedAbout.length > ABOUT_MAX_LENGTH) {
            setIsError(true);
            setErrorMsg(
                isRTL
                    ? "ظ†طµ ط§ظ„ظ†ط¨ط°ط© ظٹط¬ط¨ ط£ظ„ط§ ظٹطھط¬ط§ظˆط² 99 ط­ط±ظپط§."
                    : "About must be 99 characters or less.",
            );
            return;
        }

        if (!hasNameChanged && !hasAboutChanged && !hasImageChanged) {
            setIsEditing(false);
            return;
        }

        try {
            setLoading(true);
            setIsError(false);
            setErrorMsg("");

            let nextImage = committedImage;
            let nextAbout = committedAbout;
            let nextAboutCiphertext = aboutCiphertext ?? "";
            let nextAboutEncryptedAesKey = aboutEncryptedAesKey ?? "";
            let nextAboutIv = aboutIv ?? "";

            if (selectedProfileImage) {
                const uploadResult = await uploadEncryptedProfileImage(selectedProfileImage);
                nextImage = uploadResult.imageUrl;
            }

            if (hasAboutChanged) {
                nextAbout = trimmedAbout;

                if (trimmedAbout) {
                    const encryptedAbout = await encryptText(trimmedAbout);
                    nextAboutCiphertext = encryptedAbout.ciphertext;
                    nextAboutEncryptedAesKey = encryptedAbout.encryptedAesKey;
                    nextAboutIv = encryptedAbout.iv;
                } else {
                    nextAboutCiphertext = "";
                    nextAboutEncryptedAesKey = "";
                    nextAboutIv = "";
                }
            }

            const payload: {
                name?: string;
                image?: string;
                aboutCiphertext?: string;
                aboutEncryptedAesKey?: string;
                aboutIv?: string;
            } = {};

            if (hasNameChanged) {
                payload.name = trimmedName;
            }

            if (hasImageChanged) {
                payload.image = nextImage;
            }

            if (hasAboutChanged) {
                payload.aboutCiphertext = nextAboutCiphertext;
                payload.aboutEncryptedAesKey = nextAboutEncryptedAesKey;
                payload.aboutIv = nextAboutIv;
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

            if (hasAboutChanged) {
                setCommittedAbout(nextAbout);
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
        aboutState,
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
        setAboutState,
        setNameState,
    };
};
