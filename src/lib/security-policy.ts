const MOBILE_AUTH_ORIGINS = [
    "chatappandroid://",
    "YaHla.YaHla:/",
] as const;

const DEV_AUTH_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
] as const;

const EXTRA_ORIGINS_ENV_KEYS = [
    "BETTER_AUTH_TRUSTED_ORIGINS",
    "AUTH_ALLOWED_ORIGINS",
    "CORS_ALLOWED_ORIGINS",
] as const;

export const AUTH_CORS_METHODS = ["GET", "POST", "OPTIONS"] as const;

export function getAuthTrustedOrigins() {
    const origins = new Set<string>();

    for (const origin of MOBILE_AUTH_ORIGINS) {
        origins.add(origin);
    }

    const authUrlOrigin = normalizeWebOrigin(process.env.BETTER_AUTH_URL);
    if (authUrlOrigin) {
        origins.add(authUrlOrigin);
    }

    for (const key of EXTRA_ORIGINS_ENV_KEYS) {
        for (const origin of parseOriginList(process.env[key])) {
            origins.add(origin);
        }
    }

    if (process.env.NODE_ENV !== "production") {
        for (const origin of DEV_AUTH_ORIGINS) {
            origins.add(origin);
        }
    }

    return Array.from(origins);
}

export function isAllowedAuthCorsOrigin(origin: string | null) {
    if (!origin) {
        return false;
    }

    return getAuthTrustedOrigins().some((trustedOrigin) =>
        originsMatch(origin, trustedOrigin)
    );
}

export function applySecurityHeaders(headers: Headers) {
    headers.set(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "connect-src 'self' https: wss:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join("; ")
    );
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()"
    );
    headers.set(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload"
    );
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Resource-Policy", "same-site");
    headers.set("X-DNS-Prefetch-Control", "off");
}

export function applyAuthCorsHeaders(request: Request, headers: Headers) {
    appendVary(headers, "Origin");

    const origin = request.headers.get("origin");
    if (!isAllowedAuthCorsOrigin(origin)) {
        return;
    }

    headers.set("Access-Control-Allow-Origin", origin!);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", AUTH_CORS_METHODS.join(", "));
    headers.set(
        "Access-Control-Allow-Headers",
        request.headers.get("access-control-request-headers") ??
            "Authorization, Content-Type, X-Requested-With"
    );
    headers.set("Access-Control-Max-Age", "600");
}

export function isDisallowedCorsRequest(request: Request) {
    const origin = request.headers.get("origin");

    return Boolean(origin && !isAllowedAuthCorsOrigin(origin));
}

function parseOriginList(value: string | undefined) {
    return (value ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function normalizeWebOrigin(value: string | undefined) {
    if (!value) {
        return null;
    }

    try {
        const url = new URL(value);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }

        return url.origin;
    } catch {
        return null;
    }
}

function originsMatch(origin: string, trustedOrigin: string) {
    const normalizedOrigin = normalizeWebOrigin(origin);
    const normalizedTrustedOrigin = normalizeWebOrigin(trustedOrigin);

    if (normalizedOrigin && normalizedTrustedOrigin) {
        return normalizedOrigin === normalizedTrustedOrigin;
    }

    return origin === trustedOrigin;
}

function appendVary(headers: Headers, value: string) {
    const current = headers.get("Vary");
    if (!current) {
        headers.set("Vary", value);
        return;
    }

    const values = current.split(",").map((entry) => entry.trim().toLowerCase());
    if (!values.includes(value.toLowerCase())) {
        headers.set("Vary", `${current}, ${value}`);
    }
}
