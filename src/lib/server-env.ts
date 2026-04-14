import { config as loadDotEnv } from "dotenv";

type RequiredServerEnvKey =
    | "DATABASE_URL"
    | "BETTER_AUTH_SECRET"
    | "BETTER_AUTH_URL";

type ServerEnv = Record<RequiredServerEnvKey, string>;

let cachedEnv: ServerEnv | null = null;
let didTryLoadingDotEnv = false;

const requiredKeys: RequiredServerEnvKey[] = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
];

function tryLoadLocalDotEnv() {
    if (didTryLoadingDotEnv) {
        return;
    }

    didTryLoadingDotEnv = true;

    if (requiredKeys.every((key) => process.env[key])) {
        return;
    }

    loadDotEnv({ path: ".env.local", override: false });
    loadDotEnv({ path: ".env", override: false });
}

function readRequiredEnv(key: RequiredServerEnvKey): string {
    const value = process.env[key];

    if (!value) {
        throw new Error(
            `Missing required server environment variable: ${key}. ` +
                "Use your local .env/.env.local for development, and Cloudflare vars/secrets for production."
        );
    }

    return value;
}

export function getServerEnv(): ServerEnv {
    if (cachedEnv) {
        return cachedEnv;
    }

    tryLoadLocalDotEnv();

    cachedEnv = {
        DATABASE_URL: readRequiredEnv("DATABASE_URL"),
        BETTER_AUTH_SECRET: readRequiredEnv("BETTER_AUTH_SECRET"),
        BETTER_AUTH_URL: readRequiredEnv("BETTER_AUTH_URL"),
    };

    return cachedEnv;
}
