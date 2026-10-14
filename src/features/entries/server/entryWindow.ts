import { type EntityManager, type FilterQuery } from '@mikro-orm/core'
import { Entry } from '../Entry.js'
import { TaskStatus } from '../TaskStatus.js'
import { EntryType } from '../EntryType.js'

/** A task still awaiting an outcome; no status at all counts as open. Cast because `_type` is private. */
const openTask = {
	_type: EntryType.Task,
	$or: [{ status: null }, { status: { $nin: [TaskStatus.Done, TaskStatus.Cancelled] } }],
} as unknown as FilterQuery<Entry>

/**
 * Which one-off entries a window asks for; recurring entries travel whole, with their overrides. Two kinds travel with
 * every window because none can contain them: undated rows, and open tasks already past due. The planning surface draws both.
 */
export function entryWindow(sourceIds: ReadonlyArray<string>, start: Date, end: Date): FilterQuery<Entry> {
	return {
		sourceId: { $in: [...sourceIds] },
		recurrence: null,
		recurringEntryId: null,
		$or: [
			{ start: { $gte: start, $lte: end } },
			{ end: { $gte: start, $lte: end } },
			{ start: { $lte: start }, end: { $gte: end } },
			{ start: null },
			{ $and: [openTask, { $or: [{ due: { $lt: start } }, { end: { $lt: start } }, { end: null, start: { $lt: start } }] }] },
		],
	}
}

/** Every one-off entry, whatever its dates; recurring entries travel whole, with their overrides. */
export function everyEntry(sourceIds: ReadonlyArray<string>): FilterQuery<Entry> {
	return { sourceId: { $in: [...sourceIds] }, recurrence: null, recurringEntryId: null }
}

/** The entries a palette search matches. A series matches as its master; `nearestOccurrence` then names the occurrence it opens. */
export function entrySearch(sourceIds: ReadonlyArray<string>, query: string): FilterQuery<Entry> {
	const term = `%${query.trim()}%`
	return {
		sourceId: { $in: [...sourceIds] },
		// Availability is background, not something to search for.
		type: { $ne: EntryType.Availability },
		$or: [
			{ heading: { $like: term } },
			{ description: { $like: term } },
			{ location: { $like: term } },
		],
	}
}

/** Every recurring entry in the sources, with its overrides. */
export async function recurringEntries(em: EntityManager, sourceIds: ReadonlyArray<string>): Promise<Array<Entry>> {
	const recurring = await em.find(Entry, { sourceId: { $in: [...sourceIds] }, recurrence: { $ne: null } })
	await withOverrides(em, recurring)
	return recurring
}

/** Reads each recurring entry's overrides into it. */
export async function withOverrides(em: EntityManager, entries: ReadonlyArray<Entry>) {
	const overrides = entries.length ? await em.find(Entry, { recurringEntryId: { $in: entries.map(entry => entry.id!) } }) : []
	const byEntry = Map.groupBy(overrides, override => override.recurringEntryId!)
	for (const entry of entries) {
		entry.overrides = byEntry.get(entry.id!)
	}
}
