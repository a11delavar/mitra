import { calendarViews, type CalendarView } from '../CalendarView.js'
import { ChoiceSetting, setting, userStorage } from '../../settings/client/Setting.js'

/**
 * Initial calendar view setting (stored per user).
 */
@setting()
export class DefaultViewSetting extends ChoiceSetting<CalendarView> {
	/** Available view choices. */
	static readonly choices = calendarViews

	/** Current default calendar view. */
	static get current(): CalendarView {
		return new DefaultViewSetting().value
	}

	/** Localized view display label. */
	private static label(view: CalendarView): string {
		switch (view) {
			case 'week': return t('Week')
			case 'month': return t('Month')
			case 'year': return t('Year')
			case 'timeline': return t('Timeline')
		}
	}

	readonly heading = t('Default View')
	readonly icon = 'layout-grid'
	readonly keywords = t('DefaultViewSetting.Keywords')
	readonly page = 'calendar'
	readonly fallback: CalendarView = 'week'

	protected readonly storage = userStorage('defaultView')

	override get options() {
		return DefaultViewSetting.choices.map(view => ({ value: view, label: DefaultViewSetting.label(view) }))
	}

	/** Excludes direct verbs from palette to prevent accidental preference edits instead of navigation. */
	override get verbs() { return [] }
}
