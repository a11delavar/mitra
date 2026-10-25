import { GetPushKey, RegisterDevice, RemoveDevice } from '#operations'
import { DeviceFacts } from '../DeviceFacts.js'
import { type NotificationSubscription } from '../NotificationSubscription.js'

function base64UrlToBytes(value: string): Uint8Array {
	const padded = value + '='.repeat((4 - value.length % 4) % 4)
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export function pushSupported() {
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function subscribe(): Promise<PushSubscription> {
	const registration = await navigator.serviceWorker.register('/sw.js')
	const { key } = await GetPushKey.call()
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: base64UrlToBytes(key) as BufferSource,
	})
	const { endpoint, keys } = subscription.toJSON()
	await RegisterDevice.call({
		endpoint: endpoint!,
		keys: { p256dh: keys!.p256dh!, auth: keys!.auth! },
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		locale: String(Localizer.locales.current),
		...DeviceFacts.current(),
	})
	return subscription
}

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

export function syncPushSubscription() {
	if (pushSupported() && Notification.permission === 'granted') {
		subscribe().catch(() => void 0)
	}
}

// Notifications are written in the locale the device last registered with.
Localizer.locales.change.subscribe(() => syncPushSubscription())

export async function currentEndpoint(): Promise<string | undefined> {
	if (!pushSupported() || Notification.permission !== 'granted') {
		return undefined
	}
	const registration = await navigator.serviceWorker.getRegistration()
	const subscription = await registration?.pushManager.getSubscription()
	return subscription?.endpoint
}

/** Also unsubscribes this browser when it is the device removed. */
export async function forgetDevice(device: NotificationSubscription) {
	await RemoveDevice.call({ id: device.id })
	if (await currentEndpoint() === device.endpoint) {
		const registration = await navigator.serviceWorker.getRegistration()
		await (await registration?.pushManager.getSubscription())?.unsubscribe()
	}
}
