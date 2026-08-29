import { calendarViews, type CalendarView } from '../calendar/CalendarView.js'

/**
 * Persisted contract for user preferences (`User.settings`).
 * Only deviations from code defaults are persisted (omitted = default, null = explicit none).
 */
export class UserSettings {
	/** Initial calendar view. */
	defaultView?: CalendarView
	/** Default duration in minutes for new timed entries. */
	defaultDurationMinutes?: number
	/** Grid snap granularity in minutes for time edits and gestures. */
	snapMinutes?: number
	/** Lead time in minutes before entry start for default reminders (null = none). */
	defaultReminderMinutes?: number | null

	/**
	 * Sanitizes user settings input, dropping unknown keys and out-of-range values.
	 * Returns undefined when empty to keep database column NULL.
	 */
	static sanitize(input: unknown): UserSettings | undefined {
		const incoming = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
		const settings: UserSettings = {}
		const minutes = (value: unknown, max: number) =>
			typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max

		if (calendarViews.includes(incoming.defaultView as CalendarView)) {
			settings.defaultView = incoming.defaultView as CalendarView
		}
		if (minutes(incoming.defaultDurationMinutes, 24 * 60)) {
			settings.defaultDurationMinutes = incoming.defaultDurationMinutes as number
		}
		if (minutes(incoming.snapMinutes, 60)) {
			settings.snapMinutes = incoming.snapMinutes as number
		}
		if ('defaultReminderMinutes' in incoming) {
			const value = incoming.defaultReminderMinutes
			if (value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 28 * 24 * 60)) {
				settings.defaultReminderMinutes = value as number | null
			}
		}
		return Object.keys(settings).length ? settings : undefined
	}
}
