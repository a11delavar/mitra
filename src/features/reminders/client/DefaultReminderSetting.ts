import { EntryType } from '#features/entries'
import { ChoiceSetting, setting, userStorage } from '#features/settings/client/Setting.js'
import { getSettings } from '#infrastructure/http/Api.js'
import { RemindersField } from './RemindersField.js'
import { ReminderDefaults } from '../ReminderDefaults.js'

/** Default reminder offset for new timed entries, per kind (null = none). */
export abstract class ReminderSetting extends ChoiceSetting<number | null> {
	/** Supported reminder offsets in minutes (null = none). */
	static readonly choices: Array<number | null> = [null, 0, 5, 10, 30, 60, 1440]

	readonly icon = 'bell'
	readonly page = 'notifications'

	protected abstract readonly type: EntryType

	override get options() {
		return ReminderSetting.choices.map(minutes => ({ value: minutes, label: minutes === null ? t('None') : RemindersField.labelOf(minutes, this.type) }))
	}
}

@setting()
export class DefaultReminderSetting extends ReminderSetting {
	protected readonly type = EntryType.Event
	readonly heading = t('Default event reminder')
	readonly keywords = t('DefaultReminderSetting.Keywords')
	override get hint() { return t('Timed entries only') }
	readonly fallback = ReminderDefaults.standard.event
	protected readonly storage = userStorage('defaultReminderMinutes')
}

@setting()
export class DefaultTaskReminderSetting extends ReminderSetting {
	protected readonly type = EntryType.Task
	readonly heading = t('Default task reminder')
	readonly keywords = t('DefaultTaskReminderSetting.Keywords')
	override get hint() { return t('Tasks with a time only') }
	readonly fallback = ReminderDefaults.standard.task
	protected readonly storage = userStorage('defaultTaskReminderMinutes')
}

ReminderDefaults.from(() => ReminderDefaults.of(getSettings()))
