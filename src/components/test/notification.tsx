"use client";

import { getSubscriptionDebugState, sendNotification } from '@/app/actions';
import React, { useEffect, useState } from 'react'

export default function Notification() {
    const [status, setStatus] = useState('')
    const [serverSubscriptions, setServerSubscriptions] = useState<number | null>(null)

    async function refreshDebugState() {
        const debugState = await getSubscriptionDebugState()
        setServerSubscriptions(debugState.subscriptions)
    }

    useEffect(() => {
        refreshDebugState()
    }, [])

    async function sendTest() {
        const result = await sendNotification({
            title: 'Test Notification',
            body: 'Push notifications are working!',
            url: '/',
            badgeCount: 1,
        })

        if (!result.success) {
            await refreshDebugState()
            setStatus(result.message ?? 'Notification was not delivered.')
            return
        }

        await refreshDebugState()
        setStatus(`Delivered to ${result.delivered} subscription(s).`)
    }

    return (
        <div>
            <button onClick={sendTest}>Send Test Notification</button>
            <button onClick={refreshDebugState}>Refresh Subscription State</button>
            <p>Server subscriptions: {serverSubscriptions ?? '...'}</p>
            {status ? <p>{status}</p> : null}
        </div>
    )
}
