export async function POST(request: Request) {
    try {
        const body = (await request.json()) as {
            timestamp?: string;
            step?: string;
            details?: Record<string, unknown> | null;
            source?: string;
            href?: string;
        };

        console.log(
            `[media-debug] ${body.timestamp ?? new Date().toISOString()} ${body.step ?? "client.unknown"}`,
            {
                source: body.source ?? "client",
                href: body.href ?? null,
                ...(body.details ?? {}),
            }
        );

        return Response.json({ ok: true });
    } catch (error) {
        console.log("[media-debug] client.forward.error", {
            error:
                error instanceof Error
                    ? error.message
                    : "Failed to parse forwarded client debug log",
        });

        return Response.json({ ok: false }, { status: 400 });
    }
}
