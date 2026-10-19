import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { createEvent, editOccurrence, settleTimeZone } from '../../../infrastructure/http/Api.js'
import { OperationServer, type SentEntry as Row } from '../../../infrastructure/operations/OperationServer.testing.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../../recurrence/RecurrenceFrequency.js'
import type { EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { EntryTimeZone } from '../EntryTimeZone.js'
import { iso, midnight, shown, utcMidnight, viewIn, zones } from './viewers.testing.js'
import { EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'

describe('UpdateEntryOccurrence', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const stored = async (id: string) => (await server.query<{ start: number | null, end: number | null, exdates: string | null }>('select start, end, exdates from entry where id = ?', [id]))[0]
	const named = (heading: string) => server.query<{ start: number, end: number, recurring_entry_id: string | null }>('select start, end, recurring_entry_id from entry where heading = ?', [heading])

	describe('an occurrence of an all-day series', () => {
		it('becomes an entry of its own on the day its viewer points at, which the series then skips', async () => {
			viewIn(zones.tehran)
			const { id } = await createEvent(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading: 'Market', allDay: true, start: midnight('2026-07-06'), end: midnight('2026-07-07'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) }))

			viewIn(zones.newYork)
			const [, second] = (await shown('2026-07-01', '2026-07-25')).filter(occurrence => occurrence.recurringEntryId === id)
			const edited = second!.override()
			edited.heading = 'Night market'
			await editOccurrence(second!.recurringEntry!.occurrences.overriddenBy(edited), EntryOccurrenceChangeScope.This)
			assert.deepEqual((await named('Night market')).map(row => [row.start, row.end, row.recurring_entry_id]), [[utcMidnight('2026-07-13'), utcMidnight('2026-07-14'), null]])
			assert.deepEqual(JSON.parse((await stored(id!))!.exdates ?? '[]'), [utcMidnight('2026-07-13')])

			viewIn(zones.auckland)
			const seen = (await shown('2026-07-01', '2026-07-21')).filter(occurrence => occurrence.recurringEntryId === id || occurrence.entry.heading === 'Night market')
			assert.deepEqual(seen.map(occurrence => [occurrence.entry.heading, iso(occurrence.start)]).sort(), [['Market', iso(midnight('2026-07-06'))], ['Market', iso(midnight('2026-07-20'))], ['Night market', iso(midnight('2026-07-13'))]])
		})
	})

	// A drag from the all-day lane into the hours, or back, through one of a series' dates: the date it moved from is a day.
	describe('a series dragged between the all-day lane and the hours', () => {
		beforeEach(() => viewIn(zones.berlin))
		const berlin = (wall: string) => Date.parse(Temporal.PlainDateTime.from(wall).toZonedDateTime('Europe/Berlin').toInstant().toString())
		const daily = async (heading: string, init: Partial<Entry>) => {
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
			await editOccurrence(dragged(third!, false, new DateTime(berlin('2026-11-04T17:45'))), EntryOccurrenceChangeScope.All)
			assert.deepEqual((await dates()).map(occurrence => [occurrence.entry.allDay, iso(occurrence.start)]), ['02', '03', '04', '05', '06'].map(day => [false, new Date(berlin(`2026-11-${day}T17:45`)).toISOString()]))
		})

		it('keeps the dates before the one dragged with those after it', async () => {
			const { dates } = await daily('Split into the hours', { allDay: true, start: midnight('2026-11-02'), end: midnight('2026-11-03') })
			const [, , third] = await dates()
			await editOccurrence(dragged(third!, false, new DateTime(berlin('2026-11-04T06:00'))), EntryOccurrenceChangeScope.Following)
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
			const probe = third!.override(); probe.setAllDay(true, 60)
			await editOccurrence(dragged(third!, true, midnight('2026-11-04')), EntryOccurrenceChangeScope.All)
			assert.deepEqual(Object.values((await stored(created.id!))!).slice(0, 2), [utcMidnight('2026-11-02'), utcMidnight('2026-11-03')])
			assert.deepEqual((await dates()).map(occurrence => iso(occurrence.start)), ['02', '03', '04', '05', '06'].map(day => iso(midnight(`2026-11-${day}`))))
		})
	})

	describe('as a tool', () => {
		let series: string
		before(async () => {
			await settleTimeZone('Europe/Berlin')
			series = (await server.tool<Row>('create_entry', { heading: 'Water plants', type: 'task', start: '2027-03-01T08:00[Europe/Berlin]', estimate: 15, recurrence: 'FREQ=WEEKLY;BYDAY=MO' })).id
		})

		it('moves one occurrence alone, which becomes an entry of its own', async () => {
			const moved = await server.tool<Row>('update_entry_occurrence', { id: series, occurrence: '2027-03-01T07:00:00Z', scope: 'this', start: '2027-03-02T08:00[Europe/Berlin]' })
			assert.notEqual(moved.id, series)
			assert.equal(moved.start, '2027-03-02T07:00:00.000Z')
		})

		it('refuses a date the entry never takes place on', async () => {
			const answer = await server.callTool('update_entry_occurrence', { id: series, occurrence: '2027-03-03T07:00:00Z', scope: 'this', heading: 'Nope' })
			assert.equal(answer.isError, true)
			assert.match(answer.content[0]!.text, /takes no place/)
		})
	})
})
