export type ProfilePictureVisibility = "all" | "contacts" | "nobody";

export function canViewProfilePicture(
    visibility: ProfilePictureVisibility | string | null | undefined,
    isSavedContact: boolean
) {
    if (visibility === "all") {
        return true;
    }

    if (visibility === "contacts") {
        return isSavedContact;
    }

    return false;
}
