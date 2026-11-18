import { deviceStorage, setting, ToggleSetting } from '#features/settings/client/Setting.js'

const stored = deviceStorage<boolean>('Mitra.Week.Whole')

/** Lays the week view out as whole weeks: seven days from the locale's first, however wide the screen. */
@setting()
export class WholeWeekSetting extends ToggleSetting {
	private static readonly default = false

	static get current(): boolean {
		return stored.read() ?? WholeWeekSetting.default
	}

	readonly heading = t('Show whole weeks')
	readonly icon = 'calendar-range'
	readonly keywords = t('WholeWeekSetting.Keywords')
	readonly page = 'calendar'
	readonly fallback = WholeWeekSetting.default

	override get hint() {
		return t('The week view shows seven days, starting on the first day of the week.')
	}

	protected readonly storage = stored
}
