import { FLOATING_TIME_ZONE, type Entry } from '../entries/Entry.js'
import { ReminderNotification } from './ReminderNotification.js'

/**
 * Due reminders: when each fires, and the notification it sends.
 */

const MINUTE = 60_000

export class DueReminder {
	/** The reminders of `entries` due within `(watermark, until]`, floating times read in the zone `zoneOf` gives. */
	static within(entries: ReadonlyArray<Entry>, watermark: Date, until: Date, zoneOf?: (entry: Entry) => string | undefined): Array<DueReminder> {
		return entries.flatMap(entry => {
			// A closed task keeps its reminders, so they must be skipped here.
			if (!entry.reminders?.length || entry.closed) {
				return []
			}
			const anchor = entry.reminderAnchorInstant(zoneOf?.(entry))
			if (anchor === undefined) {
				return []
			}
			return entry.reminders
				.map(minutes => new DueReminder(entry, minutes, anchor))
				.filter(({ fireAt }) => fireAt > watermark.getTime() && fireAt <= until.getTime())
		})
	}

	constructor(
		readonly entry: Entry,
		readonly minutes: number,
		/** Observer-resolved anchor timestamp in epoch ms. */
		readonly anchor: number,
	) { }

	/** Target fire timestamp in epoch ms. */
	get fireAt() {
		return this.anchor - this.minutes * MINUTE
	}

	notification() {
		const { entry } = this
		return new ReminderNotification({
			heading: entry.heading,
			kind: entry.type?.isTask ? 'task' : 'event',
			tag: `${entry.id}|${this.minutes}`,
			timestamp: this.anchor,
			when: {
				start: (entry.start as Date | undefined)?.getTime(),
				end: ((entry.remindersAnchorToEnd ? entry.due : entry.end) as Date | undefined)?.getTime(),
				...entry.allDay ? { allDay: true } : undefined,
				...entry.timeZone === FLOATING_TIME_ZONE ? { floating: true } : undefined,
				...entry.remindersAnchorToEnd ? { due: true } : undefined,
			},
			location: entry.location || undefined,
			entry: {
				id: entry.id!,
				...entry.recurringEntryId ? { master: entry.recurringEntryId } : undefined,
				...entry.recurrenceId ? { recurrenceId: (entry.recurrenceId as unknown as Date).getTime() } : undefined,
			},
		})
	}
}
