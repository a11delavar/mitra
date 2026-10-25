import { html } from '@a11d/lit'
import { SendTestNotification } from '#operations'
import { Setting, setting, type SettingStorage } from '#features/settings/client/Setting.js'
import { SettingsStore } from '#features/settings/client/SettingsStore.js'
import { pushSupported } from './push.js'
import './NotificationDevices.js'

/** The devices reminders arrive on, once this browser shows them: a test sent to them all, and each one listed. Nothing here is a preference. */
@setting()
export class DevicesSetting extends Setting<undefined> {
	private static sent?: 'event' | 'task'

	readonly heading = t('Devices')
	readonly icon = 'monitor-smartphone'
	readonly keywords = undefined
	readonly page = 'notifications'
	readonly fallback = undefined

	protected readonly storage: SettingStorage<undefined> = { read: () => undefined, write: () => undefined }

	override get applies() { return pushSupported() && Notification.permission === 'granted' }

	override get hint() {
		switch (DevicesSetting.sent) {
			case 'event': return t('Sent a test event reminder to your devices.')
			case 'task': return t('Sent a test task reminder to your devices.')
			default: return t('Where your reminders arrive')
		}
	}

	private async test(kind: 'event' | 'task') {
		await SendTestNotification.call({ kind })
		DevicesSetting.sent = kind
		SettingsStore.notify()
	}

	override get control() {
		return html`
			<mitra-button @click=${() => this.test('event')}>${t('Test event')}</mitra-button>
			<mitra-button @click=${() => this.test('task')}>${t('Test task')}</mitra-button>
		`
	}

	override get details() {
		return html`<mitra-notification-devices></mitra-notification-devices>`
	}
}
