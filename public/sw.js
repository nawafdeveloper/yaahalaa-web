self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {}
    const title = data.title ?? 'Notification'
    const badgeCount = Number.isFinite(data.badgeCount) ? data.badgeCount : undefined
    const options = {
        body: data.body ?? '',
        icon: data.icon ?? '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: { url: data.url ?? '/' },
    }

    const notificationPromise = self.registration.showNotification(title, options)
    const badgePromise =
        self.navigator && 'setAppBadge' in self.navigator
            ? self.navigator.setAppBadge(badgeCount).catch(() => undefined)
            : Promise.resolve()

    event.waitUntil(Promise.all([notificationPromise, badgePromise]))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const clearBadgePromise =
        self.navigator && 'clearAppBadge' in self.navigator
            ? self.navigator.clearAppBadge().catch(() => undefined)
            : Promise.resolve()

    event.waitUntil(
        Promise.all([
            clients.openWindow(event.notification.data.url),
            clearBadgePromise,
        ])
    )
})
