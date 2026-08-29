import { html } from '@a11d/lit'
import { Setting, setting, type SettingStorage } from '../../settings/client/Setting.js'
import { enablePushNotifications, pushSupported } from './push.js'

/** Browser notification permission setting. Uses browser permission state directly. */
@setting()
export class NotificationsSetting extends Setting<boolean> {
	readonly heading = t('Reminder notifications')
	readonly icon = 'bell-ring'
	readonly keywords = t('NotificationsSetting.Keywords')
	readonly page = 'notifications'
	readonly fallback = false

	protected readonly storage: SettingStorage<boolean> = {
		// Browser permission is the authority.
		read: () => Notification.permission === 'default' ? undefined : Notification.permission === 'granted',
		write: async value => {
			if (value) {
				await enablePushNotifications()
			}
		},
	}

	/** Only available when browser supports Web Push. */
	override get applies() { return pushSupported() }

	override get hint() {
		switch (Notification.permission) {
			case 'granted': return t('This browser will show your reminders.')
			case 'denied': return t('This browser is blocking notifications — allow them in its site settings to get reminders here.')
			default: return t('Reminders you add are always saved; this decides whether this browser may also alert you.')
		}
	}

	// Only undecided permissions offer direct palette verb.
	override get verbs() {
		return Notification.permission !== 'default' ? [] : [{
			heading: `${this.heading}: ${t('Toggle.On')}`,
			apply: () => this.set(true),
		}]
	}

	override get control() {
		return Notification.permission === 'default' ? html`
			<button @click=${() => void this.set(true)}>${t('Allow')}</button>
		` : html`
			<span class="state" ?data-denied=${Notification.permission === 'denied'}>
				${Notification.permission === 'granted' ? t('Allowed') : t('Blocked')}
			</span>
		`
	}
}
