import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryStatus, EntryType } from '#features/entries'
import { EntryEditorIntent } from '#features/entries/client/EntryEditorIntent.js'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { Recurrence, RecurrenceFrequency } from '#features/recurrence'
import { TableWindow } from './TableWindow.js'
import { TableRow, TableFilter, type TableFacet } from './TableRow.js'

describe('TableRow', () => {
	const day = new DateTime('2026-08-19T00:00:00')
	const entry = (init?: Partial<Entry>) => new Entry({
		id: 'a', sourceId: 's', type: EntryType.Event, heading: 'Standup', start: day.add({ hours: 9 }), end: day.add({ hours: 10 }), ...init,
	})
	const task = (init?: Partial<Entry>) => entry({ id: 'b', type: EntryType.Task, status: EntryStatus.ToDo, ...init })
	/** A one-off entry as the table lists it. */
	const shown = (entry: Entry) => entry.occurrences.single
	const leaving = (key: TableFacet, ...values: Array<string>) => new TableFilter().excluding(key, new Set(values))

	beforeEach(() => {
		EntryEditorIntent.reset()
		EntryStore.reset()
	})

	it('is one row per entry instance, so a selection survives a re-render', () => {
		const standup = entry()
		assert.equal(TableRow.for(shown(standup)), TableRow.for(shown(standup)))
		assert.notEqual(TableRow.for(shown(standup)), TableRow.for(shown(entry())))
	})

	it('sorts headings regardless of case', () => {
		assert.equal(TableRow.for(shown(entry({ heading: 'Zebra' }))).headingKey < TableRow.for(shown(entry({ heading: 'apple' }))).headingKey, false)
	})

	it('sorts When by the start, or a due-only task by its due', () => {
		assert.equal(TableRow.for(shown(entry())).when, day.add({ hours: 9 }).valueOf())
		assert.equal(TableRow.for(shown(task({ start: undefined, end: day.add({ hours: 17 }) }))).when, day.add({ hours: 17 }).valueOf())
		assert.equal(TableRow.for(shown(task({ start: undefined, end: undefined }))).when, undefined)
	})

	it('ranks statuses in their order, an event without one as confirmed', () => {
		const ranks = [
			task(),
			task({ status: EntryStatus.Doing }),
			task({ status: EntryStatus.Done }),
			entry(),
			entry({ status: EntryStatus.Tentative }),
			entry({ status: EntryStatus.Cancelled }),
		].map(entry => TableRow.for(shown(entry)).statusRank)
		assert.deepEqual(ranks, [0, 1, 2, 3, 4, 5])
		assert.equal(TableRow.for(shown(entry())).status, EntryStatus.Confirmed)
	})

	it('measures the duration in minutes and leaves an undated row without one', () => {
		assert.equal(TableRow.for(shown(entry())).durationMinutes, 60)
		assert.equal(TableRow.for(shown(task({ start: undefined, end: undefined }))).durationMinutes, undefined)
	})

	it('takes the first line of the description', () => {
		assert.equal(TableRow.for(shown(entry({ description: '\n  \nBring the slides\nand the cable' }))).description, 'Bring the slides')
	})

	describe('filtering', () => {
		it('lists everything by default', () => {
			assert.equal(TableRow.for(shown(entry())).matches('', new TableFilter()), true)
			assert.equal(TableRow.for(shown(task())).matches('', new TableFilter()), true)
		})

		it('leaves out the types a type filter excludes', () => {
			assert.equal(TableRow.for(shown(entry())).matches('', leaving('typeKey', 'event')), false)
			assert.equal(TableRow.for(shown(task())).matches('', leaving('typeKey', 'event')), true)
			assert.equal(TableRow.for(shown(task())).matches('', leaving('typeKey', 'task')), false)
		})

		it('files an event under its own status', () => {
			assert.equal(TableRow.for(shown(entry())).facet('statusRank'), EntryStatus.Confirmed.code)
			assert.equal(TableRow.for(shown(entry())).matches('', leaving('statusRank', EntryStatus.Done.code)), true)
			assert.equal(TableRow.for(shown(entry())).matches('', leaving('statusRank', EntryStatus.Confirmed.code)), false)
			assert.equal(TableRow.for(shown(entry({ status: EntryStatus.Cancelled }))).matches('', leaving('statusRank', EntryStatus.Cancelled.code)), false)
			assert.equal(TableRow.for(shown(task({ status: EntryStatus.Done }))).matches('', leaving('statusRank', EntryStatus.Done.code)), false)
			assert.equal(TableRow.for(shown(task())).matches('', leaving('statusRank', EntryStatus.Done.code, EntryStatus.Cancelled.code)), true)
		})

		it('reads a task without a status as to do', () => {
			assert.equal(TableRow.for(shown(task({ status: undefined }))).facet('statusRank'), EntryStatus.ToDo.code)
		})

		it('filters by calendar and by whether the entry repeats', () => {
			assert.equal(TableRow.for(shown(entry())).matches('', leaving('sourceName', 's')), false)
			assert.equal(TableRow.for(shown(entry())).matches('', leaving('sourceName', 'other')), true)
			assert.equal(TableRow.for(shown(entry())).matches('', leaving('repeats', 'once')), false)
			assert.equal(TableRow.for(shown(entry({ recurringEntryId: 'm' }))).matches('', leaving('repeats', 'once')), true)
			assert.equal(TableRow.for(shown(entry({ recurringEntryId: 'm' }))).matches('', leaving('repeats', 'repeating')), false)
		})

		it('matches every term of the query across the title, the location and the description', () => {
			const row = TableRow.for(shown(entry({ heading: 'Standup', location: 'Room 4', description: 'Bring the slides' })))
			assert.equal(row.matches('stand', new TableFilter()), true)
			assert.equal(row.matches('room slides', new TableFilter()), true)
			assert.equal(row.matches('room cable', new TableFilter()), false)
		})

		it('lifts a column\'s filter when its excluded values empty, and stays the same filter when nothing changes', () => {
			const filter = leaving('typeKey', 'event')
			assert.equal(filter.has('typeKey'), true)
			assert.equal(filter.excluding('typeKey').has('typeKey'), false)
			assert.equal(filter.excluding('statusRank'), filter)
			assert.equal(filter.excluding('location', new Set(['Room 4'])), filter)
		})

		it('keeps the row the editor holds whatever the filters say', () => {
			const standup = entry()
			EntryEditorIntent.requestOpen('a')
			assert.equal(TableRow.for(shown(standup)).matches('nothing', leaving('typeKey', 'event')), true)
		})
	})

	describe('the window', () => {
		const september = TableWindow.between(new DateTime('2026-09-01T00:00:00'), new DateTime('2026-09-30T00:00:00'))

		it('keeps dated rows that touch it', () => {
			assert.equal(TableRow.for(shown(entry({ start: new DateTime('2026-09-01T09:00:00'), end: new DateTime('2026-09-01T10:00:00') }))).inWindow(september), true)
			assert.equal(TableRow.for(shown(entry({ start: new DateTime('2026-08-30T09:00:00'), end: new DateTime('2026-09-02T10:00:00') }))).inWindow(september), true)
		})

		it('drops dated rows outside it, an all-day one ending the day before included', () => {
			assert.equal(TableRow.for(shown(entry())).inWindow(september), false)
			const allDay = entry({ allDay: true, start: new DateTime('2026-08-31T00:00:00'), end: new DateTime('2026-09-01T00:00:00') })
			assert.equal(TableRow.for(shown(allDay)).inWindow(september), false)
		})

		it('keeps undated, overdue and unsaved rows in any window', () => {
			assert.equal(TableRow.for(shown(task({ start: undefined, end: undefined }))).inWindow(september), true)
			const overdue = task({ start: new DateTime().subtract({ days: 3 }), end: new DateTime().subtract({ days: 2 }) })
			assert.equal(overdue.overdue, true)
			assert.equal(TableRow.for(shown(overdue)).inWindow(TableWindow.of('next7')), true)
			assert.equal(TableRow.for(shown(entry({ id: undefined }))).inWindow(september), true)
		})

		it('keeps everything when it has no bounds', () => {
			assert.equal(TableRow.for(shown(entry({ start: new DateTime('2001-03-01T09:00:00'), end: new DateTime('2001-03-01T10:00:00') }))).inWindow(TableWindow.of('all')), true)
		})
	})

	describe('a series', () => {
		const start = day.add({ hours: 9 })
		const recurring = entry({ id: 'm', start, end: start.add({ hours: 1 }), recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		const occurrence = (at: DateTime) => recurring.occurrences.at(at)
		const all = TableWindow.of('all')

		it('is one row, reaching the whole series, where the window has no bounds', () => {
			const row = TableRow.for((occurrence(start)), all)
			assert.equal(row.series, true)
			assert.equal(row.scope, 'all')
		})

		it('lists each occurrence on its own, changed alone, where the window has bounds', () => {
			const row = TableRow.for((occurrence(start)), TableWindow.of('next30'))
			assert.equal(row.series, false)
			assert.equal(row.scope, 'this')
		})

		it('does not let a later occurrence stand for the series', () => {
			assert.equal(TableRow.for((occurrence(start.add({ days: 1 }))), all).series, false)
		})

		it('reaches a single entry itself, with no scope to pick', () => {
			assert.equal(TableRow.for(shown(entry()), all).scope, undefined)
		})
	})
})
