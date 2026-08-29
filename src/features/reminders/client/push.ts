import { Api } from '@a11d/api'

/**
 * Web Push client utilities for managing notification permissions, service worker registration, and subscriptions.
 */

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
	await Api.post('/push/subscription', { ...subscription.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
	return subscription
}

/** Requests notification permission and subscribes browser to Web Push. */
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

/** Refreshes push subscription if permission was already granted. */
export function syncPushSubscription() {
	if (pushSupported() && Notification.permission === 'granted') {
		subscribe().catch(() => void 0)
	}
}

/** Returns the push subscription endpoint of the current browser. */
export async function currentEndpoint(): Promise<string | undefined> {
	if (!pushSupported() || Notification.permission !== 'granted') {
		return undefined
	}
	const registration = await navigator.serviceWorker.getRegistration()
	const subscription = await registration?.pushManager.getSubscription()
	return subscription?.endpoint
}

/** Sends a test notification to all registered user devices. */
export function sendTestNotification() {
	return Api.post('/push/test')
}

/** Unregisters a device subscription by endpoint. */
export async function unregisterDevice(endpoint: string) {
	await Api.delete(`/push/subscription?endpoint=${encodeURIComponent(endpoint)}`)
	if (await currentEndpoint() === endpoint) {
		const registration = await navigator.serviceWorker.getRegistration()
		await (await registration?.pushManager.getSubscription())?.unsubscribe()
	}
}
