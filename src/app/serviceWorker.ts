/**
 * The service worker: the piece the browser's push service can wake with NO mitra tab open, receiving
 * the (end-to-end encrypted) reminder payload and showing the OS notification. Bundled standalone
 * (scripts/esbuild.ts `serviceWorkerOptions`) and served as `/sw.js`; the page registers it in
 * features/reminders/client/push.ts. It deliberately does nothing else (no caching or offline concerns), so
 * updates to it are rare and never gate the app.
 *
 * The server renders each notification for this device, so the worker shows what it receives. Anything it
 * imports is bundled INTO it, so it may only reach for dependency-free modules (deviceFacts), never the
 * ORM-bound domain classes.
 */

import { type PushPayload } from '../features/reminders/ReminderNotification.js'
import { deviceFacts } from '../features/reminders/deviceFacts.js'

// The worker global, typed structurally: the bundle shares the frontend tsconfig (DOM lib), which
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
		matchAll(options: { type: 'window', includeUncontrolled: boolean }): Promise<Array<WindowClientLike>>
		openWindow(url: string): Promise<unknown>
		claim(): Promise<unknown>
	}
}

interface WindowClientLike {
	focus(): Promise<unknown>
	/** Only works on a client this worker controls. */
	navigate?(url: string): Promise<unknown>
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

// Take over immediately on update. This worker holds no state worth a graceful handover, and without
// this a new version idles in "waiting" until every mitra tab closes.
worker.addEventListener('install', () => worker.skipWaiting())

// Android needs an `icon`, or Chrome draws a letter avatar of the origin; elsewhere it only adds a second
// picture beside the text, the app's own icon already heading the notification. Android's status bar keeps
// only the badge's alpha channel, so there the badge is the monochrome silhouette.
const android = /Android/i.test(navigator.userAgent)
const appIcon = '/android-chrome-192x192.png'
const icon = android ? appIcon : undefined
const badge = android ? '/notification-badge.png' : appIcon

// Claim open tabs so a notification tap can navigate one instead of opening a second window.
worker.addEventListener('activate', event => event.waitUntil(worker.clients.claim()))

worker.addEventListener('push', event => {
	const payload = (event.data?.json() ?? {}) as PushPayload
	event.waitUntil(worker.registration.showNotification(payload.title || 'Mitra', {
		body: payload.body,
		tag: payload.tag,
		// Chrome rejects `renotify` without a tag, and a push that shows nothing gets a generic browser notification.
		renotify: !!payload.tag,
		icon,
		badge,
		timestamp: payload.timestamp,
		requireInteraction: true,
		data: payload,
		actions: payload.actions ?? [],
	}))
})

worker.addEventListener('notificationclick', event => {
	const payload = event.notification.data
	event.notification.close()
	if (event.action === 'snooze') {
		event.waitUntil(post('/api/push/snooze', payload?.facts ?? {}))
		return
	}
	if (event.action === 'done') {
		event.waitUntil(complete(payload))
		return
	}
	event.waitUntil(open(payload))
})

/** Opens the entry instead when the request fails, e.g. on an expired session. */
async function complete(payload: PushPayload | undefined): Promise<unknown> {
	const entry = payload?.facts?.entry
	if (!entry) {
		return undefined
	}
	const response = await post(`/api/entries/${encodeURIComponent(entry.master ?? entry.id)}/complete`, { recurrenceId: entry.recurrenceId })
	return response?.ok ? undefined : open(payload)
}

/** Takes an open mitra tab to the entry, or opens one. */
async function open(payload: PushPayload | undefined): Promise<unknown> {
	const url = payload?.url || '/'
	const [client] = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true })
	if (client) {
		await client.focus()
		try {
			if (client.navigate && await client.navigate(url) !== null) {
				return undefined
			}
		} catch {
			// A tab loaded before this worker activated is not controlled.
		}
	}
	return worker.clients.openWindow(url)
}

function post(url: string, body: unknown) {
	return fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}).catch(() => undefined)
}

/** Re-subscribes when push service rotates subscription endpoints. */
worker.addEventListener('pushsubscriptionchange', event => {
	event.waitUntil((async () => {
		const { key } = await fetch('/api/push/key').then(response => response.json()) as { key: string }
		const subscription = await worker.registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToBytes(key) as BufferSource,
		})
		// The old endpoint lets the server carry over the device's name and language, which this worker can't read.
		await post('/api/push/subscription', {
			...subscription.toJSON() as object,
			previousEndpoint: event.oldSubscription?.endpoint,
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			...deviceFacts(),
		})
	})())
})

/** Convert base64url VAPID key to Uint8Array for PushManager. */
function base64UrlToBytes(value: string): Uint8Array {
	const padded = value + '='.repeat((4 - value.length % 4) % 4)
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(binary, character => character.charCodeAt(0))
}
