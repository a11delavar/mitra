import { reminderLabel } from './RemindersField.js'
import { ChoiceSetting, setting, userStorage } from '../../settings/client/Setting.js'

/**
 * Default reminder offset preference for new timed entries (null = none).
 */
@setting()
export class DefaultReminderSetting extends ChoiceSetting<number | null> {
	/** Supported reminder offsets in minutes (null = none). */
	static readonly choices: Array<number | null> = [null, 0, 5, 10, 30, 60, 1440]

	/** Initial reminder array for new timed entries. */
	static get reminders(): Array<number> | undefined {
		const minutes = new DefaultReminderSetting().value
		return minutes === null ? undefined : [minutes]
	}

	readonly heading = t('Default Reminder')
	readonly icon = 'bell'
	readonly keywords = t('DefaultReminderSetting.Keywords')
	readonly page = 'notifications'
	override get hint() { return t('Timed entries only') }
	readonly fallback: number | null = 30

	protected readonly storage = userStorage('defaultReminderMinutes')

	override get options() {
		return DefaultReminderSetting.choices.map(minutes => ({ value: minutes, label: minutes === null ? t('None') : reminderLabel(minutes) }))
	}
}
