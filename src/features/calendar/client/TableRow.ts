import { DateTime } from '@3mo/date-time'
import { type Entry, TaskStatus } from '#features/entries'
import { EntrySegments } from '#features/entries/client/EntrySegments.js'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { type EntryOccurrence, EntryOccurrenceChangeScope } from '#features/recurrence'
import { Relations } from '#features/relations/client/Relations.js'
import { termsMatch } from '#features/commands/termsMatch.js'
import { type TableWindow } from './TableWindow.js'

/** The columns a row can be filtered by, each by one value of the row's own. */
export const tableFacets = ['statusRank', 'typeKey', 'sourceName', 'repeats'] as const
export type TableFacet = typeof tableFacets[number]

/** The columns' filters: per column, the values it leaves out. */
export class TableFilter {
	constructor(readonly excluded: ReadonlyMap<TableFacet, ReadonlySet<string>> = new Map()) { }

	has(column: string) {
		return this.excluded.has(column as TableFacet)
	}

	/** The filter with a column's excluded values replaced, where none lifts the column's filter. Unchanged, it is the same filter. */
	excluding(column: string, values: ReadonlySet<string> = new Set()): TableFilter {
		if (!TableRow.isFacet(column) || (!values.size && !this.has(column))) {
			return this
		}
		const excluded = new Map(this.excluded)
		if (values.size) {
			excluded.set(column, values)
		} else {
			excluded.delete(column)
		}
		return new TableFilter(excluded)
	}
}

/** One occurrence as the table lists it: the facts a column sorts and filters by, beside the occurrence itself. */
export class TableRow {
	private static readonly rows = new WeakMap<EntryOccurrence, TableRow>()
	private static readonly seriesRows = new WeakMap<EntryOccurrence, TableRow>()

	/**
	 * One row per occurrence, so a selection and a rendered row survive a re-render. Listing an unbounded window, a
	 * recurring entry's first occurrence stands for all of them; the same occurrence elsewhere is itself alone.
	 */
	static for(occurrence: EntryOccurrence, window?: TableWindow): TableRow {
		const series = !!window?.unbounded && occurrence.recurring && occurrence.first
		const rows = series ? TableRow.seriesRows : TableRow.rows
		let row = rows.get(occurrence)
		if (!row) {
			row = new TableRow(occurrence, series)
			rows.set(occurrence, row)
		}
		return row
	}

	static isFacet(key: string): key is TableFacet {
		return (tableFacets as ReadonlyArray<string>).includes(key)
	}

	/** What the status column files an event under: it has no status at all. */
	static readonly noStatus = 'none'

	private static readonly statusRanks = new Map<TaskStatus, number>([
		[TaskStatus.ToDo, 0],
		[TaskStatus.Doing, 1],
		[TaskStatus.Done, 2],
		[TaskStatus.Cancelled, 3],
	])

	private constructor(readonly occurrence: EntryOccurrence, readonly series: boolean) { }

	/** What it shows. */
	get entry() { return this.occurrence.entry }

	/** The entry an edit through the row changes: an override for a date a rule yields. */
	editable() { return EntryStore.editable(this.occurrence) }

	/** What a change made through the row reaches: every occurrence it stands for, or the one it is. */
	get scope(): EntryOccurrenceChangeScope | undefined {
		return this.series ? EntryOccurrenceChangeScope.All : this.occurrence.recurring ? EntryOccurrenceChangeScope.This : undefined
	}

	get segment() { return EntrySegments.for(this.occurrence)[0]! }

	/** Selection identity; a draft has none of its own until it is saved. */
	get id() { return this.segment.id }

	get heading() { return this.entry.heading }
	get headingKey() { return this.entry.heading.toLocaleLowerCase() }
	/** The When column shows the span and sorts by where it begins: its start, or a due-only task's due. */
	get when() { return (this.occurrence.start ?? this.occurrence.end)?.valueOf() }
	get statusRank() { return !this.entry.type.isTask ? undefined : TableRow.statusRanks.get(this.entry.status ?? TaskStatus.ToDo) }
	get typeKey() { return this.entry.type.value }
	get source() { return this.entry.source }
	get sourceName() { return this.source?.name ?? '' }
	get location() { return this.entry.location }
	get repeats() {
		const recurring = this.occurrence.recurringEntry ?? this.entry
		return recurring.recurrence?.describe(recurring.start ?? recurring.due) ?? ''
	}

	get durationMinutes() {
		const { start, end } = this.occurrence
		return !start || !end ? undefined : Math.round((end.valueOf() - start.valueOf()) / 60_000)
	}

	get participants() { return this.entry.participantList?.length || undefined }
	get reminders() { return this.entry.reminders?.length || undefined }
	get subtaskOf() { return TableRow.headingsOf(Relations.parentsOf(this.entry)) }
	get blockedBy() { return !this.entry.uid ? '' : TableRow.headingsOf(Relations.graph.predecessorsOf(this.entry.uid)) }

	private static headingsOf(entries: ReadonlyArray<Entry>) {
		return entries.map(entry => entry.heading).join(', ')
	}

	/** The description's first line, which is all a row has room for. */
	get description() {
		return this.entry.description.split('\n').map(line => line.trim()).find(Boolean) ?? ''
	}

	/** The value a column filters this row by. */
	facet(key: TableFacet): string {
		const { entry } = this
		switch (key) {
			case 'statusRank': return !entry.type.isTask ? TableRow.noStatus : (entry.status ?? TaskStatus.ToDo).code
			case 'typeKey': return entry.type.value
			case 'sourceName': return entry.sourceId
			case 'repeats': return this.occurrence.recurring || entry.partOfSeries ? 'repeating' : 'once'
		}
	}

	/** Whether the row belongs to the listed window. Undated and overdue rows ride along, as they do with every fetch window, and so does a draft. */
	inWindow(window: TableWindow, today = new DateTime()) {
		const { occurrence } = this
		const bounds = window.bounds(today)
		if (!bounds || !occurrence.start || !occurrence.entry.persisted || occurrence.overdue) {
			return true
		}
		return occurrence.start.valueOf() <= bounds.end!.valueOf() && occurrence.inclusiveEnd.valueOf() >= bounds.start!.valueOf()
	}

	/** Whether the row stays under the filters. One the editor holds always does: a palette pick must find its row. */
	matches(query: string, filter: TableFilter) {
		if (EntryEditorIntent.holds(this.occurrence)) {
			return true
		}
		for (const [key, excluded] of filter.excluded) {
			if (excluded.has(this.facet(key))) {
				return false
			}
		}
		const { entry } = this
		return !query.trim() || termsMatch(query, `${entry.heading} ${entry.location} ${entry.description} ${this.sourceName}`)
	}
}
