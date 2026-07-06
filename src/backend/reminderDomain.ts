import { type Entry } from '../shared/index.js'

/**
 * The pure reminder arithmetic, shared by the scheduler (ReminderScheduler.ts) and its tests — free of
 * the ORM/push machinery on purpose, so "what is due" stays a function of values.
 *
 * A reminder is MINUTES BEFORE START on its entry (see Entry.reminders); its fire time is simply
 * `start − minutes`. A tick fires everything in the half-open window `(watermark, now]` — exclusive at
 * the watermark (the previous tick owned that instant), inclusive at now.
 */

const MINUTE = 60_000

/** The reminders due in `(watermark, now]` among `entries` (plain rows and expanded occurrences alike). */
export function dueReminders(entries: ReadonlyArray<Entry>, watermark: Date, now: Date): Array<{ entry: Entry, minutes: number }> {
	return entries.flatMap(entry => {
		if (!entry.start || !entry.reminders?.length) {
			return []
		}
		const start = (entry.start as unknown as Date).getTime()
		return entry.reminders
			.filter(minutes => {
				const fireAt = start - minutes * MINUTE
				return fireAt > watermark.getTime() && fireAt <= now.getTime()
			})
			.map(minutes => ({ entry, minutes }))
	})
}

/** "30 min", "1 hour", "2 days" — matching the units the editor offers. English for now, like the
 * editor's own labels; localization slots in here later. */
export function reminderSpan(minutes: number): string {
	const units = [
		{ label: 'week', minutes: 7 * 24 * 60 },
		{ label: 'day', minutes: 24 * 60 },
		{ label: 'hour', minutes: 60 },
	]
	const unit = units.find(unit => minutes >= unit.minutes && minutes % unit.minutes === 0)
	if (!unit) {
		return `${minutes} min`
	}
	const count = minutes / unit.minutes
	return `${count} ${unit.label}${count === 1 ? '' : 's'}`
}
