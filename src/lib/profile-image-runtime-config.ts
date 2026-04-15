import { getCloudflareContext } from "@opennextjs/cloudflare";

type ProfileImageRuntimeConfig = {
    bucket: R2Bucket | null;
    masterKey: string;
};

function readMasterKeyFromProcessEnv(): string {
    return process.env.PROFILE_IMAGE_MASTER_KEY ?? "";
}

export async function getProfileImageRuntimeConfig(): Promise<ProfileImageRuntimeConfig> {
    try {
        const { env } = await getCloudflareContext({ async: true });

        return {
            bucket: env.PROFILE_IMAGES_BUCKET ?? null,
            masterKey: env.PROFILE_IMAGE_MASTER_KEY ?? readMasterKeyFromProcessEnv(),
        };
    } catch {
        return {
            bucket: null,
            masterKey: readMasterKeyFromProcessEnv(),
        };
    }
}
