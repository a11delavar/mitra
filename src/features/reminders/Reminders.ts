import { FLOATING_TIME_ZONE, type Entry } from '../entries/Entry.js'
/**
 * Pure reminder arithmetic for calculating due notification timestamps.
 */

const MINUTE = 60_000

export interface DueReminder {
	entry: Entry
	minutes: number
	/** Target fire timestamp in epoch ms. */
	fireAt: number
	/** Observer-resolved anchor timestamp in epoch ms. */
	anchor: number
}

/**
 * Calculate the timestamp an entry's reminders count back from, resolving floating times against observer `zone`.
 */
export function anchorInstant(entry: Entry, zone?: string): number | undefined {
	const anchor = entry.reminderAnchor
	if (!anchor) {
		return undefined
	}
	const epoch = (anchor as unknown as Date).getTime()
	if (entry.allDay || entry.timeZone !== FLOATING_TIME_ZONE || !zone) {
		return epoch
	}
	return Temporal.Instant.fromEpochMilliseconds(epoch)
		.toZonedDateTimeISO('UTC')
		.toPlainDateTime()
		.toZonedDateTime(zone, { disambiguation: 'compatible' })
		.epochMilliseconds
}

/**
 * Find reminders due within `(watermark, until]`, resolving floating time zones via `zoneOf`.
 */
export function dueReminders(entries: ReadonlyArray<Entry>, watermark: Date, until: Date, zoneOf?: (entry: Entry) => string | undefined): Array<DueReminder> {
	return entries.flatMap(entry => {
		if (!entry.reminders?.length) {
			return []
		}
		const anchor = anchorInstant(entry, zoneOf?.(entry))
		if (anchor === undefined) {
			return []
		}
		return entry.reminders
			.map(minutes => ({ entry, minutes, anchor, fireAt: anchor - minutes * MINUTE }))
			.filter(({ fireAt }) => fireAt > watermark.getTime() && fireAt <= until.getTime())
	})
}

