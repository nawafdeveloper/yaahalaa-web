import { getCloudflareContext } from '@opennextjs/cloudflare'

type PushRuntimeConfig = {
    publicKey: string
    privateKey?: string
    subject?: string
}

function readFromProcessEnv(): PushRuntimeConfig {
    return {
        publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
        privateKey: process.env.VAPID_PRIVATE_KEY,
        subject: process.env.VAPID_SUBJECT,
    }
}

export async function getPushRuntimeConfig(): Promise<PushRuntimeConfig> {
    try {
        const { env } = await getCloudflareContext({ async: true })
        return {
            publicKey:
                (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string | undefined) ??
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
                '',
            privateKey:
                (env.VAPID_PRIVATE_KEY as string | undefined) ??
                process.env.VAPID_PRIVATE_KEY,
            subject:
                (env.VAPID_SUBJECT as string | undefined) ??
                process.env.VAPID_SUBJECT,
        }
    } catch {
        return readFromProcessEnv()
    }
}
