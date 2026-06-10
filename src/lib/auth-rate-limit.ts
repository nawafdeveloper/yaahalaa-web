import { APIError } from "better-auth/api";
import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";

type PhoneOtpRateLimitRule = {
    scope: string;
    windowSeconds: number;
    max: number;
};

const PHONE_OTP_RATE_LIMITS: PhoneOtpRateLimitRule[] = [
    {
        scope: "10m",
        windowSeconds: 10 * 60,
        max: 3,
    },
    {
        scope: "24h",
        windowSeconds: 24 * 60 * 60,
        max: 20,
    },
];

export async function enforcePhoneOtpRateLimit(phoneNumber: string) {
    const phoneHash = hashPhoneNumber(normalizePhoneNumber(phoneNumber));

    for (const rule of PHONE_OTP_RATE_LIMITS) {
        await consumeRateLimit({
            ...rule,
            key: `phone-otp:${rule.scope}:${phoneHash}`,
        });
    }
}

async function consumeRateLimit({
    key,
    windowSeconds,
    max,
}: PhoneOtpRateLimitRule & { key: string }) {
    const [{ default: db }, { rateLimit }] = await Promise.all([
        import("@/db"),
        import("@/db/schema"),
    ]);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    const [entry] = await db
        .insert(rateLimit)
        .values({
            id: crypto.randomUUID(),
            key,
            count: 1,
            lastRequest: now,
        })
        .onConflictDoUpdate({
            target: rateLimit.key,
            set: {
                count: sql<number>`case when ${rateLimit.lastRequest} < ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
                lastRequest: sql<number>`case when ${rateLimit.lastRequest} < ${windowStart} then ${now} else ${rateLimit.lastRequest} end`,
            },
        })
        .returning({
            count: rateLimit.count,
            lastRequest: rateLimit.lastRequest,
        });

    if (!entry || entry.count <= max) {
        return;
    }

    const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.lastRequest + windowMs - now) / 1000)
    );

    throw new APIError(
        "TOO_MANY_REQUESTS",
        {
            code: "PHONE_OTP_RATE_LIMITED",
            message:
                "Too many verification codes requested. Please try again later.",
        },
        {
            "Retry-After": retryAfterSeconds.toString(),
            "X-Retry-After": retryAfterSeconds.toString(),
        }
    );
}

function normalizePhoneNumber(phoneNumber: string) {
    return phoneNumber.trim().replace(/[^\d+]/g, "");
}

function hashPhoneNumber(phoneNumber: string) {
    return createHash("sha256")
        .update("phone-otp-rate-limit:v1:")
        .update(phoneNumber)
        .digest("hex");
}
