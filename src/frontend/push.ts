import { Api } from '@a11d/api'

/**
 * The page side of Web Push (the receiving side lives in sw.ts, the sending side in backend/push.ts):
 * register the service worker, obtain notification permission, subscribe against the server's VAPID
 * public key, and hand the subscription to the backend.
 *
 * Permission is requested CONTEXTUALLY — the first time the user adds a reminder (the moment the ask
 * makes sense), not on app load. Once granted, {@link syncPushSubscription} refreshes the subscription
 * on every boot without prompting, so a push-service-side endpoint rotation never silently mutes
 * reminders.
 */

/** The push service's applicationServerKey wants raw bytes; VAPID keys travel base64url-encoded. */
function base64UrlToBytes(value: string): Uint8Array {
	const padded = value + '='.repeat((4 - value.length % 4) % 4)
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function supported() {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function subscribe(): Promise<void> {
	const registration = await navigator.serviceWorker.register('/sw.js')
	const { key } = await Api.get<{ key: string }>('/push/key')
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: base64UrlToBytes(key) as BufferSource,
	})
	await Api.post('/push/subscription', subscription.toJSON())
}

/** Ask for permission (if not yet decided) and subscribe. Returns whether push is active — `false`
 * means denied/unsupported: reminders still persist (and other CalDAV clients still alert), mitra
 * itself just can't notify this browser. */
export async function enablePushNotifications(): Promise<boolean> {
	if (!supported()) {
		return false
	}
	if (await Notification.requestPermission() !== 'granted') {
		return false
	}
	await subscribe()
	return true
}

/** On boot: silently refresh the subscription where permission is already granted. Never prompts. */
export function syncPushSubscription() {
	if (supported() && Notification.permission === 'granted') {
		subscribe().catch(() => void 0) // offline/transient — the next boot retries
	}
}
