import { Api } from '@a11d/api'

/**
 * The page side of Web Push (the receiving side lives in app/serviceWorker.ts, the sending side in
 * features/reminders/server/push.ts): register the service worker, obtain notification permission,
 * subscribe against the server's VAPID public key, and hand the subscription to the backend.
 *
 * Permission is requested CONTEXTUALLY — the first time the user adds a reminder (the moment the ask
 * makes sense), not on app load. Once granted, {@link syncPushSubscription} refreshes the subscription
 * on every boot without prompting, so a push-service-side endpoint rotation never silently mutes
 * reminders. A device that never gets opened heals itself instead through the service worker's
 * `pushsubscriptionchange` handler.
 */

/** The push service's applicationServerKey wants raw bytes; VAPID keys travel base64url-encoded. */
function base64UrlToBytes(value: string): Uint8Array {
	const padded = value + '='.repeat((4 - value.length % 4) % 4)
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(binary, character => character.charCodeAt(0))
}

/** Whether the current browser supports Web Push notifications. */
export function pushSupported() {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function subscribe(): Promise<PushSubscription> {
	const registration = await navigator.serviceWorker.register('/sw.js')
	const { key } = await Api.get<{ key: string }>('/push/key')
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: base64UrlToBytes(key) as BufferSource,
	})
	// The zone travels with the registration: the server runs in an arbitrary one (usually a UTC
	// container), so the devices that will READ a notification are the only honest answer to where the
	// reader is — which is what a floating entry's reminder needs to fire at the right instant.
	await Api.post('/push/subscription', { ...subscription.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
	return subscription
}

/** Ask for permission (if not yet decided) and subscribe. Returns whether push is active — `false`
 * means denied/unsupported: reminders still persist (and other CalDAV clients still alert), mitra
 * itself just can't notify this browser. */
export async function enablePushNotifications(): Promise<boolean> {
	if (!pushSupported()) {
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
	if (pushSupported() && Notification.permission === 'granted') {
		subscribe().catch(() => void 0) // offline/transient — the next boot retries
	}
}

/** This browser's own push endpoint, if it has one. The endpoint is a device's identity, so it is also
 * how the notification settings tell "this device" apart from the user's other registrations. */
export async function currentEndpoint(): Promise<string | undefined> {
	if (!pushSupported() || Notification.permission !== 'granted') {
		return undefined
	}
	const registration = await navigator.serviceWorker.getRegistration()
	const subscription = await registration?.pushManager.getSubscription()
	return subscription?.endpoint
}

/** Send a notification to every registered device, down the same path a reminder takes. */
export function sendTestNotification() {
	return Api.post('/push/test')
}

/** Stop notifying one device — this browser included (its row goes, and so does its local subscription). */
export async function unregisterDevice(endpoint: string) {
	await Api.delete(`/push/subscription?endpoint=${encodeURIComponent(endpoint)}`)
	if (await currentEndpoint() === endpoint) {
		const registration = await navigator.serviceWorker.getRegistration()
		await (await registration?.pushManager.getSubscription())?.unsubscribe()
	}
}
