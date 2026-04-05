'use server'

import webpush from 'web-push'
import {
    listSubscriptions,
    removeSubscription,
    saveSubscription,
} from '@/lib/push-subscriptions-store'

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
)

export async function subscribeUser(sub: webpush.PushSubscription) {
    const subscriptions = saveSubscription(sub)
    // TODO: Replace the temporary store with your DB insert/upsert.
    return { success: true, subscriptions: subscriptions.length }
}

export async function unsubscribeUser(endpoint: string) {
    const subscriptions = removeSubscription(endpoint)
    // TODO: Replace the temporary store with your DB delete.
    return { success: true, subscriptions: subscriptions.length }
}

export async function getSubscriptionDebugState() {
    const subscriptions = listSubscriptions()

    return {
        success: true,
        subscriptions: subscriptions.length,
        endpoints: subscriptions.map((sub) => sub.endpoint),
    }
}

export async function syncExistingSubscription(sub: webpush.PushSubscription | null) {
    if (!sub) {
        return { success: true, subscriptions: listSubscriptions().length }
    }

    const subscriptions = saveSubscription(sub)
    // TODO: Replace the temporary store with your DB upsert.
    return { success: true, subscriptions: subscriptions.length }
}

export async function sendNotification(payload: {
    title: string
    body: string
    url?: string
    badgeCount?: number
}) {
    const subscriptions = listSubscriptions()

    if (subscriptions.length === 0) {
        return {
            success: false,
            delivered: 0,
            failed: 0,
            subscriptions: 0,
            message: 'No active push subscriptions were found on the server.',
        }
    }

    const results = await Promise.allSettled(
        subscriptions.map((sub) =>
            webpush.sendNotification(sub, JSON.stringify(payload))
        )
    )

    let delivered = 0
    let failed = 0

    // Clean up expired subscriptions (410 = gone, 404 = not found)
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            delivered += 1
            return
        }

        failed += 1
        if (result.status === 'rejected') {
            const status = result.reason?.statusCode
            if (status === 410 || status === 404) {
                removeSubscription(subscriptions[i].endpoint)
                // TODO: Replace the temporary store cleanup with your DB delete.
            }
        }
    })

    return {
        success: delivered > 0,
        delivered,
        failed,
        subscriptions: subscriptions.length,
    }
}
