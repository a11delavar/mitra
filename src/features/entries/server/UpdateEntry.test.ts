import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, createSource, editOccurrence, updateEvent } from '../../../infrastructure/http/Api.js'
import { OperationServer } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'
import type { EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { EntryTimeZone } from '../EntryTimeZone.js'
import { fetched, iso, midnight, shown, utcMidnight, viewIn, zones } from './viewers.testing.js'

describe('UpdateEntry', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const stored = async (id: string) => (await server.query<{ start: number | null, end: number | null, exdates: string | null }>('select start, end, exdates from entry where id = ?', [id]))[0]
	const named = (heading: string) => server.query<{ start: number, end: number, recurring_entry_id: string | null }>('select start, end, recurring_entry_id from entry where heading = ?', [heading])
	const timed = (heading: string) => new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start: new DateTime('2026-07-01T09:00:00Z'), end: new DateTime('2026-07-01T10:00:00Z') })

	describe('an all-day entry', () => {
		it('keeps its days through an edit elsewhere, and moves by a whole day where its viewer moves it', async () => {
			viewIn(zones.berlin)
			const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Holiday', allDay: true, start: midnight('2026-06-02'), end: midnight('2026-06-05') }))

			viewIn(zones.newYork)
			const holiday = (await fetched('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			holiday.heading = 'Long weekend'
			await updateEvent(holiday)
			assert.deepEqual(Object.values((await stored(id!))!).slice(0, 2), [utcMidnight('2026-06-02'), utcMidnight('2026-06-05')])

			holiday.start = midnight('2026-06-03')
			const moved = await updateEvent(holiday)
			assert.equal(iso(moved.start), iso(midnight('2026-06-03')))
			assert.deepEqual(Object.values((await stored(id!))!).slice(0, 2), [utcMidnight('2026-06-03'), utcMidnight('2026-06-05')])

			viewIn(zones.auckland)
			const seen = (await fetched('2026-05-25', '2026-06-15')).find(entry => entry.id === id)!
			assert.deepEqual([seen.heading, iso(seen.start), iso(seen.end)], ['Long weekend', iso(midnight('2026-06-03')), iso(midnight('2026-06-05'))])
		})
	})

	describe('an entry moved or converted', () => {
		it('is created in the other calendar under a new id, keeping its uid, and leaves the first', async () => {
			viewIn(zones.berlin)
			const work = await createSource(server.integration.id, { name: 'Work' })
			const created = await createEvent(timed('Review'))
			created.sourceId = work.id
			const moved = await updateEvent(created)
			assert.notEqual(moved.id, created.id)
			assert.equal(moved.sourceId, work.id)
			assert.equal(moved.uid, created.uid)
			assert.equal(await stored(created.id!), undefined)
			assert.deepEqual(Object.values((await stored(moved.id!))!).slice(0, 2), [Date.parse('2026-07-01T09:00:00Z'), Date.parse('2026-07-01T10:00:00Z')])
		})

		it('becomes a task under a new id in the same calendar', async () => {
			viewIn(zones.berlin)
			const created = await createEvent(timed('Write up'))
			created.type = EntryType.Task
			const converted = await updateEvent(created)
			assert.notEqual(converted.id, created.id)
			assert.equal(converted.type, EntryType.Task)
			assert.equal(await stored(created.id!), undefined)
		})
	})

	describe('an occurrence of an all-day series', () => {
		it('becomes an entry of its own on the day its viewer points at, which the series then skips', async () => {
			viewIn(zones.tehran)
			const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Market', allDay: true, start: midnight('2026-07-06'), end: midnight('2026-07-07'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }))

			viewIn(zones.newYork)
			const [, second] = (await shown('2026-07-01', '2026-07-25')).filter(occurrence => occurrence.recurringEntryId === id)
			const edited = second!.override()
			edited.heading = 'Night market'
			await editOccurrence(second!.recurringEntry!.occurrences.overriddenBy(edited), 'this')
			assert.deepEqual((await named('Night market')).map(row => [row.start, row.end, row.recurring_entry_id]), [[utcMidnight('2026-07-13'), utcMidnight('2026-07-14'), null]])
			assert.deepEqual(JSON.parse((await stored(id!))!.exdates ?? '[]'), [utcMidnight('2026-07-13')])

			viewIn(zones.auckland)
			const seen = (await shown('2026-07-01', '2026-07-21')).filter(occurrence => occurrence.recurringEntryId === id || occurrence.entry.heading === 'Night market')
			assert.deepEqual(seen.map(occurrence => [occurrence.entry.heading, iso(occurrence.start)]).sort(), [['Market', iso(midnight('2026-07-06'))], ['Market', iso(midnight('2026-07-20'))], ['Night market', iso(midnight('2026-07-13'))]])
		})
	})

	// A drag from the all-day lane into the hours, or back, through one of a series' dates: the date it moved from is a day.
	describe('a series dragged between the all-day lane and the hours', () => {
		const berlin = (wall: string) => Date.parse(Temporal.PlainDateTime.from(wall).toZonedDateTime('Europe/Berlin').toInstant().toString())
		const daily = async (heading: string, init: Partial<Entry>) => {
			viewIn(zones.berlin)
			const created = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, ...init, heading, recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily, count: 5 }) }))
			const dates = () => shown('2026-11-01', '2026-11-12').then(occurrences => occurrences.filter(occurrence => occurrence.entry.heading === heading || occurrence.recurringEntryId === created.id))
			return { created, dates }
		}
		const dragged = (occurrence: EntryOccurrence, allDay: boolean, start: DateTime) => {
			const edited = occurrence.override()
			edited.setAllDay(allDay, 60)
			edited.moveStart(start)
			return occurrence.recurringEntry!.occurrences.overriddenBy(edited)
		}

		it('moves every date to the hour it was dropped at, each on its own day', async () => {
			const { dates } = await daily('Into the hours', { allDay: true, start: midnight('2026-11-02'), end: midnight('2026-11-03') })
			const [, , third] = await dates()
			await editOccurrence(dragged(third!, false, new DateTime(berlin('2026-11-04T17:45'))), 'all')
			assert.deepEqual((await dates()).map(occurrence => [occurrence.entry.allDay, iso(occurrence.start)]), ['02', '03', '04', '05', '06'].map(day => [false, new Date(berlin(`2026-11-${day}T17:45`)).toISOString()]))
		})

		it('keeps the dates before the one dragged with those after it', async () => {
			const { dates } = await daily('Split into the hours', { allDay: true, start: midnight('2026-11-02'), end: midnight('2026-11-03') })
			const [, , third] = await dates()
			await editOccurrence(dragged(third!, false, new DateTime(berlin('2026-11-04T06:00'))), 'following')
			assert.deepEqual((await dates()).map(occurrence => [occurrence.entry.allDay, iso(occurrence.start)]), [
				[true, iso(midnight('2026-11-02'))],
				[true, iso(midnight('2026-11-03'))],
				...['04', '05', '06'].map(day => [false, new Date(berlin(`2026-11-${day}T06:00`)).toISOString()]),
			])
		})

		it('stores the days a timed series is dragged onto as their UTC midnights, wherever it was written', async () => {
			const start = new DateTime(Date.parse('2026-11-02T06:00:00+03:30'))
			const { created, dates } = await daily('Into the lane', { start, end: start.add({ hours: 1 }), timeZone: EntryTimeZone.parse('Asia/Tehran') })
			const [, , third] = await dates()
			await editOccurrence(dragged(third!, true, midnight('2026-11-04')), 'all')
			assert.deepEqual(Object.values((await stored(created.id!))!).slice(0, 2), [utcMidnight('2026-11-02'), utcMidnight('2026-11-03')])
			assert.deepEqual((await dates()).map(occurrence => iso(occurrence.start)), ['02', '03', '04', '05', '06'].map(day => iso(midnight(`2026-11-${day}`))))
		})
	})
})
