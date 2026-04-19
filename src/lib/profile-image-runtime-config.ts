import { getCloudflareContext } from "@opennextjs/cloudflare";

type ProfileImageRuntimeConfig = {
    bucket: R2Bucket | null;
};

/**
 * Get the R2 bucket for profile image storage.
 */
export async function getProfileImageRuntimeConfig(): Promise<ProfileImageRuntimeConfig> {
    try {
        const { env } = await getCloudflareContext({ async: true });

        return {
            bucket: env.PROFILE_IMAGES_BUCKET ?? null,
        };
    } catch {
        return {
            bucket: null,
        };
    }
}
