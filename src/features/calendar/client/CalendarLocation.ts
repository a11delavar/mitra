import { DateTime } from '@3mo/date-time'
import { calendarViews, type CalendarView } from '../CalendarView.js'

/** The route and query parameters the calendar page round-trips through the URL. */
export type CalendarParameters = {
	view?: string
	date?: string
	selected?: string
	settings?: string
}

/**
 * Value object representing URL-serializable calendar navigation state (view, date, selected entry, settings page).
 */
export class CalendarLocation {
	static from(parameters: CalendarParameters | undefined, fallbackView: CalendarView) {
		return new CalendarLocation(
			calendarViews.find(view => view === parameters?.view) ?? fallbackView,
			CalendarLocation.dateFrom(parameters?.date) ?? new DateTime(),
			parameters?.selected || undefined,
			parameters?.settings || undefined,
		)
	}

	/** Parses current window Location before router initialization. */
	static of(url: URL | Location, fallbackView: CalendarView) {
		const search = new URLSearchParams(url.search)
		return CalendarLocation.from({ view: url.pathname.split('/')[1], ...Object.fromEntries(search) }, fallbackView)
	}

	private static dateFrom(value: string | undefined) {
		const date = !value || !/^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : new DateTime(`${value}T00:00:00`)
		return date === undefined || Number.isNaN(date.valueOf()) ? undefined : date
	}

	/** Formats DateTime into YYYY-MM-DD string. */
	private static dayOf(date: DateTime) {
		return [String(date.year).padStart(4, '0'), String(date.month).padStart(2, '0'), String(date.day).padStart(2, '0')].join('-')
	}

	constructor(
		readonly view: CalendarView,
		readonly date: DateTime,
		readonly selected?: string,
		readonly settings?: string,
	) { }

	private get anchoredToday() {
		return this.date.dayStart.equals(new DateTime().dayStart)
	}

	get parameters(): CalendarParameters {
		return {
			view: this.view,
			...this.anchoredToday ? undefined : { date: CalendarLocation.dayOf(this.date) },
			...this.selected ? { selected: this.selected } : undefined,
			...this.settings ? { settings: this.settings } : undefined,
		}
	}

	/** The state as a URL: the view is the path, everything else the query. */
	url(base: string | URL = globalThis.location.href) {
		const url = new URL(`/${this.view}`, base)
		for (const [key, value] of Object.entries(this.parameters)) {
			if (key !== 'view') {
				url.searchParams.set(key, value)
			}
		}
		return url
	}
}
