import { auth } from "@/lib/auth";
import { normalizeOpenGraphData } from "@/lib/open-graph-data";
import { normalizeDetectedUrl } from "@/lib/url-links";
import type { OpenGraphData } from "@/types/messages.type";

const OPEN_GRAPH_FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 160_000;

type UserWithLinkPreviewSetting = {
    disableLinkPreview?: boolean | null;
};

export async function GET(request: Request) {
    const session = await auth.api.getSession({
        headers: new Headers(request.headers),
    });

    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionUser = session.user as UserWithLinkPreviewSetting;

    if (sessionUser.disableLinkPreview) {
        return Response.json({ openGraphData: null });
    }

    const requestUrl = new URL(request.url);
    const targetUrl = normalizeDetectedUrl(requestUrl.searchParams.get("url") ?? "");

    if (!targetUrl || !isPublicHttpUrl(targetUrl)) {
        return Response.json({ error: "Invalid URL" }, { status: 400 });
    }

    try {
        const { html, finalUrl } = await fetchHtmlPreview(targetUrl);
        const openGraphData = extractOpenGraphData(html, finalUrl);

        return Response.json({
            openGraphData: normalizeOpenGraphData(openGraphData),
        });
    } catch {
        return Response.json({ openGraphData: null }, { status: 200 });
    }
}

function isPublicHttpUrl(value: string) {
    try {
        const url = new URL(value);
        const hostname = url.hostname.toLowerCase();

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return false;
        }

        if (
            hostname === "localhost" ||
            hostname === "::1" ||
            hostname.endsWith(".localhost") ||
            hostname.endsWith(".local") ||
            hostname.startsWith("127.") ||
            hostname.startsWith("10.") ||
            hostname.startsWith("0.") ||
            hostname.startsWith("169.254.") ||
            hostname.startsWith("192.168.") ||
            (hostname.includes(":") && hostname.startsWith("fc")) ||
            (hostname.includes(":") && hostname.startsWith("fd")) ||
            hostname.startsWith("fe80:")
        ) {
            return false;
        }

        const [first, second] = hostname.split(".").map(Number);
        if (first === 172 && second >= 16 && second <= 31) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

async function fetchHtmlPreview(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPEN_GRAPH_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: {
                accept: "text/html,application/xhtml+xml",
                "user-agent": "YaaHalaa-LinkPreview/1.0",
            },
            redirect: "follow",
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error("Preview URL did not return a successful response.");
        }

        const finalUrl = response.url || url;
        if (!isPublicHttpUrl(finalUrl)) {
            throw new Error("Preview URL redirected to a private address.");
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (
            contentType &&
            !contentType.includes("text/html") &&
            !contentType.includes("application/xhtml+xml")
        ) {
            throw new Error("Preview URL did not return HTML.");
        }

        return {
            html: await readResponseText(response),
            finalUrl,
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function readResponseText(response: Response) {
    if (!response.body) {
        return (await response.text()).slice(0, MAX_HTML_BYTES);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedBytes = 0;
    let html = "";

    while (receivedBytes < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        receivedBytes += value.byteLength;
        html += decoder.decode(value, { stream: true });

        if (receivedBytes >= MAX_HTML_BYTES) {
            await reader.cancel();
        }
    }

    html += decoder.decode();

    return html;
}

function extractOpenGraphData(html: string, finalUrl: string): OpenGraphData {
    const fallbackUrl = safeAbsoluteUrl(finalUrl, finalUrl);
    const ogUrl =
        safeAbsoluteUrl(findMetaContent(html, ["og:url"]), finalUrl) ?? fallbackUrl;
    const title =
        findMetaContent(html, ["og:title", "twitter:title"]) ??
        findTitleContent(html) ??
        getHostnameTitle(ogUrl ?? finalUrl);
    const description =
        findMetaContent(html, [
            "og:description",
            "twitter:description",
            "description",
        ]) ?? null;

    return {
        og_url: ogUrl,
        og_title: title,
        og_description: description,
    };
}

function findMetaContent(html: string, keys: string[]) {
    const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
    const metaMatcher = /<meta\b[^>]*>/gi;
    let match = metaMatcher.exec(html);

    while (match) {
        const attributes = parseTagAttributes(match[0]);
        const key = (attributes.property ?? attributes.name ?? "").toLowerCase();

        if (normalizedKeys.has(key) && attributes.content) {
            return cleanHtmlText(attributes.content);
        }

        match = metaMatcher.exec(html);
    }

    return null;
}

function findTitleContent(html: string) {
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);

    return match?.[1] ? cleanHtmlText(match[1]) : null;
}

function parseTagAttributes(tag: string) {
    const attributes: Record<string, string> = {};
    const matcher = /([^\s"'=<>`]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match = matcher.exec(tag);

    while (match) {
        attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
        match = matcher.exec(tag);
    }

    return attributes;
}

function cleanHtmlText(value: string) {
    const stripped = value.replace(/<[^>]+>/g, " ");
    const decoded = decodeHtmlEntities(stripped);
    const cleaned = decoded.replace(/\s+/g, " ").trim();

    return cleaned || null;
}

function decodeHtmlEntities(value: string) {
    return value
        .replace(/&#(\d+);/g, (_, codePoint: string) =>
            String.fromCodePoint(Number(codePoint))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, codePoint: string) =>
            String.fromCodePoint(Number.parseInt(codePoint, 16))
        )
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&nbsp;/gi, " ");
}

function safeAbsoluteUrl(value: string | null, baseUrl: string) {
    if (!value) {
        return null;
    }

    try {
        const url = new URL(value, baseUrl);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }

        return url.toString();
    } catch {
        return null;
    }
}

function getHostnameTitle(value: string) {
    try {
        return new URL(value).hostname.replace(/^www\./i, "");
    } catch {
        return "Link";
    }
}
