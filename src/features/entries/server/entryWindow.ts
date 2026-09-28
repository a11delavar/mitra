import { type FilterQuery } from '@mikro-orm/core'
import { type Entry, TaskStatus } from '../Entry.js'
import { EntryType } from '../EntryType.js'

/** A task still awaiting an outcome; no status at all counts as open. Cast because `_type` is private. */
const openTask = {
	_type: EntryType.Task,
	$or: [{ status: null }, { status: { $nin: [TaskStatus.Done, TaskStatus.Cancelled] } }],
} as unknown as FilterQuery<Entry>

/**
 * Which entries a window asks for. Two kinds travel with every window because none can contain them:
 * undated rows, and open tasks already past due. The planning surface draws both.
 */
export function entryWindow(sourceIds: ReadonlyArray<string>, start: Date, end: Date): FilterQuery<Entry> {
	return {
		sourceId: { $in: [...sourceIds] },
		recurrence: { freq: null },
		$or: [
			{ start: { $gte: start, $lte: end } },
			{ end: { $gte: start, $lte: end } },
			{ start: { $lte: start }, end: { $gte: end } },
			{ start: null },
			{ $and: [openTask, { $or: [{ end: { $lt: start } }, { end: null, start: { $lt: start } }] }] },
		],
	}
}

/** Every entry once, whatever its dates. A series stands in as its start (`seriesStarts`), so its master, occurrences and overrides stay out. */
export function everyEntry(sourceIds: ReadonlyArray<string>): FilterQuery<Entry> {
	return { sourceId: { $in: [...sourceIds] }, recurrence: { freq: null }, recurrenceMasterId: null }
}
