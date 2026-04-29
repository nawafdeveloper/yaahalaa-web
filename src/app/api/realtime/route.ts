export async function GET(request: Request) {
    if (request.headers.get("upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
    }

    return Response.json(
        {
            error: "WebSocket upgrades for /api/realtime are handled by the Cloudflare worker entrypoint.",
        },
        { status: 400 }
    );
}
