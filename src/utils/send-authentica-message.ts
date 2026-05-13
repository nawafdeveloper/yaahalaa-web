import { getCloudflareContext } from "@opennextjs/cloudflare";

const AUTHENTICA_SEND_OTP_PATH = "/send-otp";

export type AuthenticaMessageMethod = "sms" | "whatsapp";

export type SendAuthenticaMessageInput = {
    phone: string;
    otp: string;
    method?: AuthenticaMessageMethod;
    templateId?: string;
    fallbackEmail?: string;
    apiKey?: string;
    baseUrl?: string;
};

type AuthenticaError = {
    message?: string;
};

export type SendAuthenticaMessageResponse = {
    success?: boolean;
    data?: unknown;
    message?: string;
    errors?: AuthenticaError[];
};

export class AuthenticaMessageError extends Error {
    status: number;
    response: SendAuthenticaMessageResponse | null;

    constructor(
        message: string,
        status: number,
        response: SendAuthenticaMessageResponse | null
    ) {
        super(message);
        this.name = "AuthenticaMessageError";
        this.status = status;
        this.response = response;
    }
}

export async function sendAuthenticaMessage({
    phone,
    otp,
    method = "sms",
    templateId,
    fallbackEmail,
    apiKey,
    baseUrl,
}: SendAuthenticaMessageInput): Promise<SendAuthenticaMessageResponse> {
    const config = await getAuthenticaRuntimeConfig({
        apiKey,
        baseUrl,
        templateId,
    });
    const normalizedPhone = phone.trim();
    const normalizedOtp = otp.trim();

    if (!normalizedPhone) {
        throw new AuthenticaMessageError("Phone number is required.", 0, null);
    }

    if (!normalizedOtp) {
        throw new AuthenticaMessageError("OTP is required.", 0, null);
    }

    const body: Record<string, string> = {
        method,
        phone: normalizedPhone,
        otp: normalizedOtp,
    };

    if (config.templateId) {
        body.template_id = config.templateId;
    }

    if (fallbackEmail?.trim()) {
        body.fallback_email = fallbackEmail.trim();
    }

    const response = await fetch(
        `${config.baseUrl.replace(/\/$/, "")}${AUTHENTICA_SEND_OTP_PATH}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "X-Authorization": config.apiKey,
            },
            body: JSON.stringify(body),
        }
    );

    const payload = await parseAuthenticaResponse(response);

    if (!response.ok || payload?.success === false || payload?.errors?.length) {
        throw new AuthenticaMessageError(
            getAuthenticaErrorMessage(payload, response.status),
            response.status,
            payload
        );
    }

    return payload ?? { success: true };
}

async function getAuthenticaRuntimeConfig({
    apiKey,
    baseUrl,
    templateId,
}: Pick<
    SendAuthenticaMessageInput,
    "apiKey" | "baseUrl" | "templateId"
>): Promise<{
    apiKey: string;
    baseUrl: string;
    templateId?: string;
}> {
    const providedApiKey = normalizeOptionalString(apiKey);
    const providedBaseUrl = normalizeOptionalString(baseUrl);
    const providedTemplateId = normalizeOptionalString(templateId);

    if (providedApiKey && providedBaseUrl && providedTemplateId) {
        return {
            apiKey: providedApiKey,
            baseUrl: providedBaseUrl,
            templateId: providedTemplateId,
        };
    }

    let env: CloudflareEnv;

    try {
        const context = await getCloudflareContext({ async: true });
        env = context.env;
    } catch {
        throw new AuthenticaMessageError(
            "Cloudflare runtime environment is unavailable for Authentica configuration.",
            0,
            null
        );
    }

    const resolvedApiKey =
        providedApiKey ?? normalizeOptionalString(env.AUTHENTICA_API_KEY);
    const resolvedBaseUrl =
        providedBaseUrl ?? normalizeOptionalString(env.AUTHENTICA_BASE_URL);
    const resolvedTemplateId =
        providedTemplateId ?? normalizeOptionalString(env.AUTHENTICA_TEMPLATE_ID);

    if (!resolvedApiKey) {
        throw new AuthenticaMessageError(
            "Missing AUTHENTICA_API_KEY Cloudflare secret.",
            0,
            null
        );
    }

    if (!resolvedTemplateId) {
        throw new AuthenticaMessageError(
            "Missing AUTHENTICA_TEMPLATE_ID Cloudflare secret.",
            0,
            null
        );
    }

    if (!resolvedBaseUrl) {
        throw new AuthenticaMessageError(
            "Missing AUTHENTICA_BASE_URL Cloudflare secret.",
            0,
            null
        );
    }

    return {
        apiKey: resolvedApiKey,
        baseUrl: resolvedBaseUrl,
        templateId: resolvedTemplateId,
    };
}

async function parseAuthenticaResponse(
    response: Response
): Promise<SendAuthenticaMessageResponse | null> {
    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text) as SendAuthenticaMessageResponse;
    } catch {
        return {
            success: response.ok,
            message: text,
        };
    }
}

function getAuthenticaErrorMessage(
    payload: SendAuthenticaMessageResponse | null,
    status: number
) {
    const providerMessage =
        payload?.errors?.find((error) => error.message)?.message ??
        payload?.message;

    return providerMessage ?? `Authentica request failed with status ${status}.`;
}

function normalizeOptionalString(value?: string) {
    const normalized = value?.trim();
    return normalized || undefined;
}
