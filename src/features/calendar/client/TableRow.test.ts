import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, TaskStatus } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { EntryEditorIntent } from '../../entries/client/EntryEditorIntent.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { TableWindow } from './TableWindow.js'
import { TableRow, TableFilter, type TableFacet } from './TableRow.js'

describe('TableRow', () => {
	const day = new DateTime('2026-08-19T00:00:00')
	const entry = (init?: Partial<Entry>) => new Entry({
		id: 'a', sourceId: 's', type: EntryType.Event, heading: 'Standup', start: day.add({ hours: 9 }), end: day.add({ hours: 10 }), ...init,
	})
	const task = (init?: Partial<Entry>) => entry({ id: 'b', type: EntryType.Task, status: TaskStatus.ToDo, ...init })
	const leaving = (key: TableFacet, ...values: Array<string>) => new TableFilter().excluding(key, new Set(values))

	beforeEach(() => {
		EntryEditorIntent.reset()
		EntryStore.reset()
	})

	it('is one row per entry instance, so a selection survives a re-render', () => {
		const standup = entry()
		assert.equal(TableRow.for(standup), TableRow.for(standup))
		assert.notEqual(TableRow.for(standup), TableRow.for(entry()))
	})

	it('sorts headings regardless of case', () => {
		assert.equal(TableRow.for(entry({ heading: 'Zebra' })).headingKey < TableRow.for(entry({ heading: 'apple' })).headingKey, false)
	})

	it('sorts When by the start, or a due-only task by its due', () => {
		assert.equal(TableRow.for(entry()).when, day.add({ hours: 9 }).valueOf())
		assert.equal(TableRow.for(task({ start: undefined, end: day.add({ hours: 17 }) })).when, day.add({ hours: 17 }).valueOf())
		assert.equal(TableRow.for(task({ start: undefined, end: undefined })).when, undefined)
	})

	it('ranks task statuses in their order and leaves events unranked', () => {
		assert.equal(TableRow.for(task()).statusRank, 0)
		assert.equal(TableRow.for(task({ status: TaskStatus.Doing })).statusRank, 1)
		assert.equal(TableRow.for(task({ status: TaskStatus.Done })).statusRank, 2)
		assert.equal(TableRow.for(task({ status: TaskStatus.Cancelled })).statusRank, 3)
		assert.equal(TableRow.for(entry()).statusRank, undefined)
	})

	it('measures the duration in minutes and leaves an undated row without one', () => {
		assert.equal(TableRow.for(entry()).durationMinutes, 60)
		assert.equal(TableRow.for(task({ start: undefined, end: undefined })).durationMinutes, undefined)
	})

	it('takes the first line of the description', () => {
		assert.equal(TableRow.for(entry({ description: '\n  \nBring the slides\nand the cable' })).description, 'Bring the slides')
	})

	describe('filtering', () => {
		it('lists everything by default', () => {
			assert.equal(TableRow.for(entry()).matches('', new TableFilter()), true)
			assert.equal(TableRow.for(task()).matches('', new TableFilter()), true)
		})

		it('leaves out the types a type filter excludes', () => {
			assert.equal(TableRow.for(entry()).matches('', leaving('typeKey', 'event')), false)
			assert.equal(TableRow.for(task()).matches('', leaving('typeKey', 'event')), true)
			assert.equal(TableRow.for(task()).matches('', leaving('typeKey', 'task')), false)
		})

		it('files an event under no status, so a status filter can keep or drop events too', () => {
			assert.equal(TableRow.for(entry()).facet('statusRank'), TableRow.noStatus)
			assert.equal(TableRow.for(entry()).matches('', leaving('statusRank', TaskStatus.Done)), true)
			assert.equal(TableRow.for(entry()).matches('', leaving('statusRank', TableRow.noStatus)), false)
			assert.equal(TableRow.for(task({ status: TaskStatus.Done })).matches('', leaving('statusRank', TaskStatus.Done)), false)
			assert.equal(TableRow.for(task()).matches('', leaving('statusRank', TaskStatus.Done, TaskStatus.Cancelled)), true)
		})

		it('reads a task without a status as to do', () => {
			assert.equal(TableRow.for(task({ status: undefined })).facet('statusRank'), TaskStatus.ToDo)
		})

		it('filters by calendar and by whether the entry repeats', () => {
			assert.equal(TableRow.for(entry()).matches('', leaving('sourceName', 's')), false)
			assert.equal(TableRow.for(entry()).matches('', leaving('sourceName', 'other')), true)
			assert.equal(TableRow.for(entry()).matches('', leaving('repeats', 'once')), false)
			assert.equal(TableRow.for(entry({ recurrenceMasterId: 'm' })).matches('', leaving('repeats', 'once')), true)
			assert.equal(TableRow.for(entry({ recurrenceMasterId: 'm' })).matches('', leaving('repeats', 'repeating')), false)
		})

		it('matches every term of the query across the title, the location and the description', () => {
			const row = TableRow.for(entry({ heading: 'Standup', location: 'Room 4', description: 'Bring the slides' }))
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
			assert.equal(TableRow.for(standup).matches('nothing', leaving('typeKey', 'event')), true)
		})
	})

	describe('the window', () => {
		const september = TableWindow.between(new DateTime('2026-09-01T00:00:00'), new DateTime('2026-09-30T00:00:00'))

		it('keeps dated rows that touch it', () => {
			assert.equal(TableRow.for(entry({ start: new DateTime('2026-09-01T09:00:00'), end: new DateTime('2026-09-01T10:00:00') })).inWindow(september), true)
			assert.equal(TableRow.for(entry({ start: new DateTime('2026-08-30T09:00:00'), end: new DateTime('2026-09-02T10:00:00') })).inWindow(september), true)
		})

		it('drops dated rows outside it, an all-day one ending the day before included', () => {
			assert.equal(TableRow.for(entry()).inWindow(september), false)
			const allDay = entry({ allDay: true, start: new DateTime('2026-08-31T00:00:00'), end: new DateTime('2026-09-01T00:00:00') })
			assert.equal(TableRow.for(allDay).inWindow(september), false)
		})

		it('keeps undated, overdue and unsaved rows in any window', () => {
			assert.equal(TableRow.for(task({ start: undefined, end: undefined })).inWindow(september), true)
			const overdue = task({ start: new DateTime().subtract({ days: 3 }), end: new DateTime().subtract({ days: 2 }) })
			assert.equal(overdue.overdue, true)
			assert.equal(TableRow.for(overdue).inWindow(TableWindow.of('next7')), true)
			assert.equal(TableRow.for(entry({ id: undefined })).inWindow(september), true)
		})

		it('keeps everything when it has no bounds', () => {
			assert.equal(TableRow.for(entry({ start: new DateTime('2001-03-01T09:00:00'), end: new DateTime('2001-03-01T10:00:00') })).inWindow(TableWindow.of('all')), true)
		})
	})

	describe('a series', () => {
		const start = day.add({ hours: 9 })
		const occurrence = (at: DateTime) => entry({
			id: `m__${at.valueOf()}`, start: at, end: at.add({ hours: 1 }),
			recurrence: new Recurrence({ freq: 'DAILY' }), recurrenceMasterId: 'm', recurrenceId: at, seriesStart: start,
		})
		const all = TableWindow.of('all')

		it('is one row, reaching the whole series, where the window has no bounds', () => {
			const row = TableRow.for(occurrence(start), all)
			assert.equal(row.series, true)
			assert.equal(row.scope, 'all')
		})

		it('lists each occurrence on its own, changed alone, where the window has bounds', () => {
			const row = TableRow.for(occurrence(start), TableWindow.of('next30'))
			assert.equal(row.series, false)
			assert.equal(row.scope, 'this')
		})

		it('does not let a later occurrence stand for the series', () => {
			assert.equal(TableRow.for(occurrence(start.add({ days: 1 })), all).series, false)
		})

		it('reaches a single entry itself, with no scope to pick', () => {
			assert.equal(TableRow.for(entry(), all).scope, undefined)
		})
	})
})
