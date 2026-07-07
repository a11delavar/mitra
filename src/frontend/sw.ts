/**
 * The service worker: the piece the browser's push service can wake with NO mitra tab open — receiving
 * the (end-to-end encrypted) reminder payload and showing the OS notification. Bundled standalone
 * (scripts/esbuild.ts `serviceWorkerOptions`) and served as `/sw.js`; the page registers it in
 * frontend/push.ts. It deliberately does nothing else — no caching/offline concerns — so updates to it
 * are rare and never gate the app.
 */

interface Payload {
	title?: string
	body?: string
	tag?: string
	timestamp?: number
	url?: string
}

// The worker global, typed structurally — the bundle shares the frontend tsconfig (DOM lib), which
// doesn't know the ServiceWorker globals.
const worker = self as unknown as {
	addEventListener(type: 'push' | 'notificationclick' | 'install' | 'activate', listener: (event: PushLikeEvent & NotificationClickLikeEvent) => void): void
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
			data?: Payload
			actions?: Array<{ action: string, title: string }>
		}): Promise<void>
	}
	clients: {
		matchAll(options: { type: 'window', includeUncontrolled: boolean }): Promise<Array<{ focus(): Promise<unknown> }>>
		openWindow(url: string): Promise<unknown>
	}
}

interface PushLikeEvent {
	data?: { json(): unknown } | null
	waitUntil(promise: Promise<unknown>): void
}

interface NotificationClickLikeEvent {
	action: string
	notification: { close(): void, data?: Payload }
	waitUntil(promise: Promise<unknown>): void
}

// Take over immediately on update — this worker holds no state worth a graceful handover, and without
// this a new version idles in "waiting" until every mitra tab closes.
worker.addEventListener('install', () => worker.skipWaiting())

worker.addEventListener('push', event => {
	const payload = (event.data?.json() ?? {}) as Payload
	event.waitUntil(worker.registration.showNotification(payload.title || 'Mitra', {
		body: payload.body || '',
		// Same tag → the notification replaces itself instead of stacking; renotify makes the
		// replacement (e.g. a snoozed re-send) alert again rather than swap silently.
		tag: payload.tag,
		renotify: true,
		// No `icon`: an installed PWA already brands the notification header with the app icon, so a large
		// body image of the same logo is pure duplication. `badge` is a different slot — the monochrome
		// glyph some platforms (Android's status bar) show instead — so it stays.
		badge: '/android-chrome-192x192.png',
		// The event's start, not the delivery instant — "when is it" beats "when did this arrive".
		timestamp: payload.timestamp,
		// A reminder is a commitment, not a toast: stay on screen until acted upon.
		requireInteraction: true,
		data: payload,
		actions: [{ action: 'snooze', title: 'Snooze 10 min' }, { action: 'open', title: 'Open' }],
	}))
})

worker.addEventListener('notificationclick', event => {
	event.notification.close()
	if (event.action === 'snooze') {
		// Hand the payload back to the server; it re-sends after the pause (see backend/push.ts).
		event.waitUntil(fetch('/api/push/snooze', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(event.notification.data ?? {}),
		}))
		return
	}
	// Plain click (or "Open"): focus an open mitra window if there is one; open the app otherwise.
	const url = event.notification.data?.url || '/'
	event.waitUntil(worker.clients.matchAll({ type: 'window', includeUncontrolled: true })
		.then(windows => windows[0] ? windows[0].focus() : worker.clients.openWindow(url)))
})
