import { DateTime } from '@3mo/date-time'
import { type Entry, TaskStatus } from '../../entries/Entry.js'
import { EntrySegments } from '../../entries/client/EntrySegments.js'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { Relations } from '../../relations/client/Relations.js'
import { getSource } from '../../../infrastructure/http/Api.js'
import { termsMatch } from '../../commands/termsMatch.js'
import { type RecurrenceScope } from '../../recurrence/Recurrence.js'
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

/** One entry as the table lists it: the facts a column sorts and filters by, beside the entry itself. */
export class TableRow {
	private static readonly rows = new WeakMap<Entry, TableRow>()
	private static readonly seriesRows = new WeakMap<Entry, TableRow>()

	/**
	 * One row per entry instance, so a selection and a rendered row survive a re-render. Listing an unbounded
	 * window, a series' start stands for the whole series; the same occurrence elsewhere is itself alone.
	 */
	static for(entry: Entry, window?: TableWindow): TableRow {
		const series = !!window?.unbounded && entry.isRecurring && entry.isSeriesStart
		const rows = series ? TableRow.seriesRows : TableRow.rows
		let row = rows.get(entry)
		if (!row) {
			row = new TableRow(entry, series)
			rows.set(entry, row)
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

	private constructor(readonly entry: Entry, readonly series: boolean) { }

	/** What a change made through the row reaches: the series it stands for, or the one occurrence it is. */
	get scope(): RecurrenceScope | undefined {
		return this.series ? 'all' : this.entry.isRecurring ? 'this' : undefined
	}

	get segment() { return EntrySegments.for(this.entry)[0]! }

	/** Selection identity; a draft has none of its own until it is saved. */
	get id() { return this.segment.id }

	get heading() { return this.entry.heading }
	get headingKey() { return this.entry.heading.toLocaleLowerCase() }
	/** The When column shows the span and sorts by where it begins: its start, or a due-only task's due. */
	get when() { return (this.entry.start ?? this.entry.end)?.valueOf() }
	get statusRank() { return !this.entry.type.isTask ? undefined : TableRow.statusRanks.get(this.entry.status ?? TaskStatus.ToDo) }
	get typeKey() { return this.entry.type.value }
	get source() { return getSource(this.entry.sourceId) }
	get sourceName() { return this.source?.name ?? '' }
	get location() { return this.entry.location }
	get repeats() { return this.entry.recurrence?.describe(this.entry.seriesStart) ?? '' }

	get durationMinutes() {
		const { start, end } = this.entry
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
			case 'statusRank': return !entry.type.isTask ? TableRow.noStatus : entry.status ?? TaskStatus.ToDo
			case 'typeKey': return entry.type.value
			case 'sourceName': return entry.sourceId
			case 'repeats': return entry.partOfSeries ? 'repeating' : 'once'
		}
	}

	/** Whether the row belongs to the listed window. Undated and overdue rows ride along, as they do with every fetch window, and so does a draft. */
	inWindow(window: TableWindow, today = new DateTime()) {
		const { entry } = this
		const bounds = window.bounds(today)
		if (!bounds || !entry.start || !entry.persisted || entry.overdue) {
			return true
		}
		return entry.start.valueOf() <= bounds.end.valueOf() && entry.inclusiveEnd.valueOf() >= bounds.start.valueOf()
	}

	/** Whether the row stays under the filters. One the editor holds always does: a palette pick must find its row. */
	matches(query: string, filter: TableFilter) {
		if (EntryEditorIntent.holds(this.entry)) {
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
