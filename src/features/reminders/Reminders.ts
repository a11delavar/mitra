import type { EntryOccurrence } from '#features/recurrence'
import type { TimeZone } from '#features/time/TimeZone.js'
import { ReminderNotification } from './ReminderNotification.js'

/**
 * Due reminders: when each fires, and the notification it sends.
 */

const MINUTE = 60_000

export class DueReminder {
	/** The reminders of `occurrences` due within `(watermark, until]`, floating times read in the zone `zoneOf` gives. */
	static within(occurrences: ReadonlyArray<EntryOccurrence>, watermark: Date, until: Date, zoneOf?: (occurrence: EntryOccurrence) => TimeZone | undefined): Array<DueReminder> {
		return occurrences.flatMap(occurrence => {
			const { entry } = occurrence
			// A closed task keeps its reminders, so they must be skipped here.
			if (!entry.reminders?.length || entry.closed) {
				return []
			}
			const anchor = occurrence.reminderAnchorInstant(zoneOf?.(occurrence))
			if (anchor === undefined) {
				return []
			}
			// The calendar's server sends the email ones.
			return entry.reminders
				.filter(reminder => !reminder.email)
				.map(({ minutes }) => new DueReminder(occurrence, minutes, anchor))
				.filter(({ fireAt }) => fireAt > watermark.getTime() && fireAt <= until.getTime())
		})
	}

	constructor(
		readonly occurrence: EntryOccurrence,
		readonly minutes: number,
		/** Observer-resolved anchor timestamp in epoch ms. */
		readonly anchor: number,
	) { }

	/** Target fire timestamp in epoch ms. */
	get fireAt() {
		return this.anchor - this.minutes * MINUTE
	}

	notification() {
		const { occurrence } = this
		const { entry } = occurrence
		return new ReminderNotification({
			heading: entry.heading,
			kind: entry.type?.isTask ? 'task' : 'event',
			tag: `${occurrence.key}|${this.minutes}`,
			timestamp: this.anchor,
			when: {
				start: occurrence.start?.getTime(),
				end: (occurrence.remindersAnchorToEnd ? occurrence.due : occurrence.end)?.getTime(),
				...entry.allDay ? { allDay: true } : undefined,
				...entry.timeZone?.floating ? { floating: true } : undefined,
				...occurrence.remindersAnchorToEnd ? { due: true } : undefined,
			},
			location: entry.location || undefined,
			entry: {
				id: occurrence.key!,
				...occurrence.recurring ? { master: occurrence.recurringEntryId } : undefined,
				...occurrence.recurrenceId ? { recurrenceId: occurrence.recurrenceId.getTime() } : undefined,
			},
		})
	}
}
