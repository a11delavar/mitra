import '#features/time/TimeSpan.time.js'
import { ChoiceSetting, setting, userStorage } from '#features/settings/client/Setting.js'
import { session } from '#infrastructure/http/PageSession.js'
import { ScheduleDefaults } from '../ScheduleDefaults.js'

/**
 * Default duration in minutes for new timed entries without explicit spans.
 */
@setting()
export class DefaultDurationSetting extends ChoiceSetting<number> {
	/** Supported duration choices in minutes. */
	static readonly choices = [15, 30, 45, 60, 90, 120]

	readonly heading = t('Default Duration')
	readonly icon = 'hourglass'
	readonly keywords = t('DefaultDurationSetting.Keywords')
	readonly page = 'entries'
	readonly fallback = ScheduleDefaults.standard.duration

	protected readonly storage = userStorage('defaultDurationMinutes')

	override get options() {
		return DefaultDurationSetting.choices.map(minutes => ({ value: minutes, label: TimeSpan.fromMinutes(minutes).formatAsWholeUnit() }))
	}
}

ScheduleDefaults.from(() => ScheduleDefaults.of(session.settings))
