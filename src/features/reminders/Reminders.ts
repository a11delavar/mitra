import type { EntityManager } from '@mikro-orm/core'
import { DateTimeRange } from '@3mo/date-time'
import type { User } from '#features/identity'
import { EntryOccurrences, type EntryOccurrence } from '#features/recurrence'
import type { TimeZone } from '#features/time/TimeZone.js'
import { ReminderNotification } from './ReminderNotification.js'

/**
 * Due reminders: when each fires, and the notification it sends.
 */

const MINUTE = 60_000

export class DueReminder {
	/** How far a stored floating time, its wall clock as if in UTC, may lie from its instant. */
	private static readonly floatingSlack = 14 * 60 * MINUTE

	/**
	 * The reminders of `user`'s entries in enabled calendars due within `(watermark, until]`, a floating time read in `zone`,
	 * where their device last was. A repeating entry's dates are read as far past `until` as its earliest reminder reaches.
	 */
	static async of(em: EntityManager, user: User, watermark: Date, until: Date, zone?: TimeZone) {
		const sources = { enabled: true }
		const after = new Date(watermark.getTime() - DueReminder.floatingSlack)
		const once = await user.filterEntries(em, { sources, where: { reminders: { $ne: null }, recurrence: null, $or: [{ start: { $gt: after } }, { start: null, due: { $gt: after } }] } })
		const recurring = await user.filterEntries(em, { sources, where: { reminders: { $ne: null }, recurrence: { $ne: null } } })
		const reach = Math.max(0, ...recurring.map(entry => entry.reminders?.earliest ?? 0)) * MINUTE
		const occurrences = [
			...once.map(entry => entry.occurrences.single),
			...EntryOccurrences.inWindow(recurring, new DateTimeRange(watermark, new Date(until.getTime() + reach))),
		]
		return DueReminder.within(occurrences, watermark, until, zone)
	}

	/** The reminders of `occurrences` due within `(watermark, until]`, floating times read in `zone`, where their reader is. */
	static within(occurrences: ReadonlyArray<EntryOccurrence>, watermark: Date, until: Date, zone?: TimeZone): Array<DueReminder> {
		return occurrences.flatMap(occurrence => {
			const { entry } = occurrence
			// A closed entry (a done or cancelled task, a cancelled event) keeps its reminders, so they must be skipped here.
			if (!entry.reminders?.length || entry.closed) {
				return []
			}
			const anchor = occurrence.reminderAnchorInstant(zone)
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
