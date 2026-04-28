import { getCloudflareContext } from "@opennextjs/cloudflare";

type MessageMediaRuntimeConfig = {
    bucket: R2Bucket | null;
};

export async function getMessageMediaRuntimeConfig(): Promise<MessageMediaRuntimeConfig> {
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
