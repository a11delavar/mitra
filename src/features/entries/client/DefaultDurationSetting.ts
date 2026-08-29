import { reminderSpanLabel } from '../../reminders/client/RemindersField.js'
import { ChoiceSetting, setting, userStorage } from '../../settings/client/Setting.js'

/**
 * Default duration in minutes for new timed entries without explicit spans.
 */
@setting()
export class DefaultDurationSetting extends ChoiceSetting<number> {
	/** Supported duration choices in minutes. */
	static readonly choices = [15, 30, 45, 60, 90, 120]

	/** Current default duration in minutes. */
	static get current() { return new DefaultDurationSetting().value }

	readonly heading = t('Default Duration')
	readonly icon = 'hourglass'
	readonly keywords = t('DefaultDurationSetting.Keywords')
	readonly page = 'entries'
	readonly fallback = 60

	protected readonly storage = userStorage('defaultDurationMinutes')

	override get options() {
		return DefaultDurationSetting.choices.map(minutes => ({ value: minutes, label: reminderSpanLabel(minutes) }))
	}
}
