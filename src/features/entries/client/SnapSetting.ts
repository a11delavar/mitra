import { reminderSpanLabel } from '../../reminders/client/RemindersField.js'
import { ChoiceSetting, setting, userStorage } from '../../settings/client/Setting.js'

/**
 * Grid snap granularity in minutes for time edits and gestures.
 */
@setting()
export class SnapSetting extends ChoiceSetting<number> {
	/** Supported grid snap intervals. */
	static readonly choices = [5, 10, 15, 30]

	static get current() { return new SnapSetting().value }

	readonly heading = t('Snap to')
	readonly icon = 'magnet'
	readonly keywords = t('SnapSetting.Keywords')
	readonly page = 'entries'
	override get hint() { return t('The step dragging and resizing land on') }
	readonly fallback = 15

	protected readonly storage = userStorage('snapMinutes')

	override get options() {
		return SnapSetting.choices.map(minutes => ({ value: minutes, label: reminderSpanLabel(minutes) }))
	}
}
