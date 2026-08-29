/**
 * The service worker: the piece the browser's push service can wake with NO mitra tab open — receiving
 * the (end-to-end encrypted) reminder payload and showing the OS notification. Bundled standalone
 * (scripts/esbuild.ts `serviceWorkerOptions`) and served as `/sw.js`; the page registers it in
 * features/reminders/client/push.ts. It deliberately does nothing else — no caching/offline concerns — so
 * updates to it are rare and never gate the app.
 *
 * Anything it imports is bundled INTO it, so it may only reach for dependency-free modules
 * (ReminderNotification.ts) — never the ORM-bound domain classes.
 */

import { ReminderNotification, type PushPayload } from '../features/reminders/ReminderNotification.js'

// The worker global, typed structurally — the bundle shares the frontend tsconfig (DOM lib), which
// doesn't know the ServiceWorker globals.
const worker = self as unknown as {
	addEventListener(type: 'push' | 'notificationclick' | 'install' | 'activate' | 'pushsubscriptionchange', listener: (event: PushLikeEvent & NotificationClickLikeEvent & SubscriptionChangeLikeEvent) => void): void
	skipWaiting(): Promise<void>
	registration: {
		showNotification(title: string, options?: {
			body?: string
			tag?: string
			icon?: string
			badge?: string
			timestamp?: number
			requireInteraction?: boolean
			renotify?: boolean
			data?: PushPayload
			actions?: Array<{ action: string, title: string }>
		}): Promise<void>
		pushManager: {
			subscribe(options: { userVisibleOnly: boolean, applicationServerKey: BufferSource }): Promise<PushSubscriptionLike>
		}
	}
	clients: {
		matchAll(options: { type: 'window', includeUncontrolled: boolean }): Promise<Array<{ focus(): Promise<unknown> }>>
		openWindow(url: string): Promise<unknown>
	}
}

interface PushSubscriptionLike {
	endpoint: string
	toJSON(): unknown
}

interface PushLikeEvent {
	data?: { json(): unknown } | null
	waitUntil(promise: Promise<unknown>): void
}

interface NotificationClickLikeEvent {
	action: string
	notification: { close(): void, data?: PushPayload }
	waitUntil(promise: Promise<unknown>): void
}

interface SubscriptionChangeLikeEvent {
	oldSubscription?: PushSubscriptionLike | null
	waitUntil(promise: Promise<unknown>): void
}

// Take over immediately on update — this worker holds no state worth a graceful handover, and without
// this a new version idles in "waiting" until every mitra tab closes.
worker.addEventListener('install', () => worker.skipWaiting())

worker.addEventListener('push', event => {
	const payload = (event.data?.json() ?? {}) as PushPayload
	event.waitUntil(worker.registration.showNotification(payload.title || 'Mitra', {
		body: new ReminderNotification(payload).bodyAt(Date.now()),
		tag: payload.tag,
		renotify: true,
		badge: '/android-chrome-192x192.png',
		timestamp: payload.timestamp,
		requireInteraction: true,
		data: payload,
		actions: [{ action: 'snooze', title: 'Snooze 10 min' }, { action: 'open', title: 'Open' }],
	}))
})

worker.addEventListener('notificationclick', event => {
	event.notification.close()
	if (event.action === 'snooze') {
		event.waitUntil(fetch('/api/push/snooze', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(event.notification.data ?? {}),
		}))
		return
	}
	const url = event.notification.data?.url || '/'
	event.waitUntil(worker.clients.matchAll({ type: 'window', includeUncontrolled: true })
		.then(windows => windows[0] ? windows[0].focus() : worker.clients.openWindow(url)))
})

/** Re-subscribes when push service rotates subscription endpoints. */
worker.addEventListener('pushsubscriptionchange', event => {
	event.waitUntil((async () => {
		const { key } = await fetch('/api/push/key').then(response => response.json()) as { key: string }
		const subscription = await worker.registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToBytes(key) as BufferSource,
		})
		await fetch('/api/push/subscription', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...subscription.toJSON() as object, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
		})
		const gone = event.oldSubscription?.endpoint
		if (gone && gone !== subscription.endpoint) {
			await fetch(`/api/push/subscription?endpoint=${encodeURIComponent(gone)}`, { method: 'DELETE' })
		}
	})())
})

/** Convert base64url VAPID key to Uint8Array for PushManager. */
function base64UrlToBytes(value: string): Uint8Array {
	const padded = value + '='.repeat((4 - value.length % 4) % 4)
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(binary, character => character.charCodeAt(0))
}
