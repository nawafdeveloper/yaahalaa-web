import type webpush from "web-push";
import {
    listSubscriptions,
    removeSubscription,
    saveSubscription,
} from "@/lib/push-subscriptions-store";

export async function POST(request: Request) {
    const body = (await request.json()) as {
        subscription?: webpush.PushSubscription | null;
    };

    if (!body.subscription) {
        return Response.json({
            success: true,
            subscriptions: listSubscriptions().length,
        });
    }

    const subscriptions = saveSubscription(body.subscription);

    return Response.json({
        success: true,
        subscriptions: subscriptions.length,
    });
}

export async function DELETE(request: Request) {
    const body = (await request.json()) as {
        endpoint?: string;
    };

    if (!body.endpoint) {
        return Response.json(
            { success: false, error: "Missing endpoint." },
            { status: 400 }
        );
    }

    const subscriptions = removeSubscription(body.endpoint);

    return Response.json({
        success: true,
        subscriptions: subscriptions.length,
    });
}
