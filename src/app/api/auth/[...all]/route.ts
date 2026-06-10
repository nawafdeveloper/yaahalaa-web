import { auth } from "@/lib/auth";
import {
    applyAuthCorsHeaders,
    applySecurityHeaders,
    isDisallowedCorsRequest,
} from "@/lib/security-policy";
import { toNextJsHandler } from "better-auth/next-js";

type AuthHandler = (request: Request) => Promise<Response>;

const authHandlers = toNextJsHandler(auth);

export const GET = withAuthProtection(authHandlers.GET);
export const POST = withAuthProtection(authHandlers.POST);

export async function OPTIONS(request: Request) {
    const headers = new Headers();
    applySecurityHeaders(headers);
    applyAuthCorsHeaders(request, headers);
    headers.set("Cache-Control", "no-store");

    if (isDisallowedCorsRequest(request)) {
        return Response.json(
            { error: "CORS origin is not allowed." },
            { status: 403, headers }
        );
    }

    return new Response(null, {
        status: 204,
        headers,
    });
}

function withAuthProtection(handler: AuthHandler): AuthHandler {
    return async (request) => {
        if (isDisallowedCorsRequest(request)) {
            const headers = new Headers();
            applySecurityHeaders(headers);
            applyAuthCorsHeaders(request, headers);
            headers.set("Cache-Control", "no-store");

            return Response.json(
                { error: "CORS origin is not allowed." },
                { status: 403, headers }
            );
        }

        const response = await handler(request);
        const headers = new Headers(response.headers);

        applySecurityHeaders(headers);
        applyAuthCorsHeaders(request, headers);
        headers.set("Cache-Control", "no-store");

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    };
}
