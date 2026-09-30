import { reminderLabel } from './RemindersField.js'
import { EntryType } from '../../entries/EntryType.js'
import { ReminderDefaults } from '../ReminderDefaults.js'
import { ChoiceSetting, setting, userStorage } from '../../settings/client/Setting.js'

/** Default reminder offset for new timed entries, per kind (null = none). */
export abstract class ReminderSetting extends ChoiceSetting<number | null> {
	/** Supported reminder offsets in minutes (null = none). */
	static readonly choices: Array<number | null> = [null, 0, 5, 10, 30, 60, 1440]

	/** Both kinds' defaults as the user has chosen them. */
	static get defaults() {
		return new ReminderDefaults(new DefaultReminderSetting().value, new DefaultTaskReminderSetting().value)
	}

	readonly icon = 'bell'
	readonly page = 'notifications'

	protected abstract readonly type: EntryType

	override get options() {
		return ReminderSetting.choices.map(minutes => ({ value: minutes, label: minutes === null ? t('None') : reminderLabel(minutes, this.type) }))
	}
}

@setting()
export class DefaultReminderSetting extends ReminderSetting {
	protected readonly type = EntryType.Event
	readonly heading = t('Default event reminder')
	readonly keywords = t('DefaultReminderSetting.Keywords')
	override get hint() { return t('Timed entries only') }
	readonly fallback: number | null = 30
	protected readonly storage = userStorage('defaultReminderMinutes')
}

@setting()
export class DefaultTaskReminderSetting extends ReminderSetting {
	protected readonly type = EntryType.Task
	readonly heading = t('Default task reminder')
	readonly keywords = t('DefaultTaskReminderSetting.Keywords')
	override get hint() { return t('Tasks with a time only') }
	/** A task is done at its time, so it reminds at that time rather than ahead of it. */
	readonly fallback: number | null = 0
	protected readonly storage = userStorage('defaultTaskReminderMinutes')
}
