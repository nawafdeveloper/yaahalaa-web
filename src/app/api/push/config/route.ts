import { getPushRuntimeConfig } from "@/lib/push-runtime-config";

export async function GET() {
    const { publicKey } = await getPushRuntimeConfig();

    return Response.json({
        success: Boolean(publicKey),
        publicKey,
    });
}
