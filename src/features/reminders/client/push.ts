import { Api } from '@a11d/api'
import { deviceFacts } from '../deviceFacts.js'
import { type NotificationSubscription } from '../NotificationSubscription.js'

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
	await Api.post('/push/subscription', {
		...subscription.toJSON(),
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		language: Localizer.languages.current,
		...deviceFacts(),
	})
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

// Notifications are written in the language the device last registered with.
Localizer.languages.change.subscribe(() => syncPushSubscription())

/** Returns the push subscription endpoint of the current browser. */
export async function currentEndpoint(): Promise<string | undefined> {
	if (!pushSupported() || Notification.permission !== 'granted') {
		return undefined
	}
	const registration = await navigator.serviceWorker.getRegistration()
	const subscription = await registration?.pushManager.getSubscription()
	return subscription?.endpoint
}

export function fetchDevices() {
	return Api.get<Array<NotificationSubscription>>('/push/subscriptions')
}

/** Sends a real reminder for a made-up entry of the given kind to every registered device. */
export function sendTestNotification(kind: 'event' | 'task') {
	return Api.post('/push/test', { kind })
}

/** An empty name restores the one the browser reports. */
export function renameDevice(id: string, name: string) {
	return Api.put<NotificationSubscription>(`/push/subscriptions/${id}/name`, { name })
}

/** Also unsubscribes this browser when it is the device removed. */
export async function forgetDevice(device: NotificationSubscription) {
	await Api.delete(`/push/subscriptions/${device.id}`)
	if (await currentEndpoint() === device.endpoint) {
		const registration = await navigator.serviceWorker.getRegistration()
		await (await registration?.pushManager.getSubscription())?.unsubscribe()
	}
}
