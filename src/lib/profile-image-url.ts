export const PROFILE_IMAGE_API_PATH = "/api/profile-image";

export function buildProfileImageObjectKey(userId: string): string {
    return `profiles/${userId}/${crypto.randomUUID()}.bin`;
}

export function buildProfileImageUrl(userId: string, objectKey: string): string {
    const params = new URLSearchParams({
        userId,
        objectKey,
    });

    return `${PROFILE_IMAGE_API_PATH}?${params.toString()}`;
}

export function parseManagedProfileImageUrl(imageUrl?: string | null): {
    userId: string;
    objectKey: string;
} | null {
    if (!imageUrl) {
        return null;
    }

    try {
        const parsed = new URL(imageUrl, "http://localhost");

        if (parsed.pathname !== PROFILE_IMAGE_API_PATH) {
            return null;
        }

        const userId = parsed.searchParams.get("userId");
        const objectKey = parsed.searchParams.get("objectKey");

        if (!userId || !objectKey) {
            return null;
        }

        return {
            userId,
            objectKey,
        };
    } catch {
        return null;
    }
}
