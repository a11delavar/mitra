import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { Recurrence, RecurrenceFrequency } from '#features/recurrence'
import { TimeZone } from '#features/time/TimeZone.js'
import { viewIn, zones } from '#features/entries/server/viewers.testing.js'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { SettleHomeTimeZone } from '#features/time/server/SettleHomeTimeZone.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

/** A routine as the tool answers it. */
interface Routine {
	readonly id: string
	readonly titles: ReadonlyArray<string>
	readonly rule?: string
	readonly since?: string
	readonly kept: number
	readonly of: number
	readonly slips?: { readonly weekday: number, readonly count: number, readonly of: number }
	readonly occurrences: ReadonlyArray<{ readonly id: string, readonly occurrence?: string, readonly type: string, readonly status: string }>
	readonly next?: { readonly start?: string }
}

describe('GetRoutines', () => {
	let server: OperationServer
	before(async () => {
		server = await OperationServer.start()
		viewIn(zones.berlin)
		await SettleHomeTimeZone.call({ id: TimeZone.of('Europe/Berlin') })
	})
	after(() => server.close())

	const routines = async (args: Record<string, unknown> = {}) => (await server.tool<{ items: ReadonlyArray<Routine> }>('get_routines', args)).items
	const routineOf = async (title: string) => (await routines()).find(routine => routine.titles.includes(title))!

	/** The fourth Sunday before today, at 23:30 in Berlin. */
	const sundayNight = () => {
		const today = Temporal.Now.plainDateISO('Europe/Berlin')
		const sunday = today.subtract({ days: (today.dayOfWeek % 7 || 7) + 21 })
		return new DateTime(sunday.toZonedDateTime({ timeZone: 'Europe/Berlin', plainTime: '23:30' }).epochMilliseconds)
	}
	const weekly = (heading: string, type = EntryType.Event) => {
		const at = sundayNight()
		return CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type, heading, start: at, end: at.add({ minutes: 20 }), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })))
	}

	it('reads a task left open late on Sunday in Berlin as missed on Sunday, and Sunday as the day it slips on', async () => {
		const { id } = await weekly('Plan the week', EntryType.Task)
		const routine = await routineOf('Plan the week')
		const missed = routine.occurrences.filter(occurrence => occurrence.status === 'missed')
		assert.equal(missed.length, 4)
		assert.ok(missed.every(date => date.id === id && date.type === 'task' && date.occurrence))
		assert.ok(missed.every(date => Temporal.Instant.from(date.occurrence!).toZonedDateTimeISO('Europe/Berlin').dayOfWeek === 7))
		assert.deepEqual([routine.kept, routine.of, routine.rule], [0, 4, 'FREQ=WEEKLY'])
		assert.deepEqual(routine.slips, { weekday: 7, count: 4, of: 4 })
	})

	it('reads an override another app renamed and ticked off as one of its recurring entry\'s dates', async () => {
		const { id } = await weekly('Tidy the desk', EntryType.Task)
		const [stored] = await server.query<{ start: number, uid: string | null, time_zone: string }>('select start, uid, time_zone from entry where id = ?', [id])
		// Two weeks on the clock its rule repeats on, since they may span a change of daylight saving time.
		const third = Temporal.Instant.fromEpochMilliseconds(stored!.start).toZonedDateTimeISO(stored!.time_zone).add({ weeks: 2 }).epochMilliseconds
		await server.query('insert into `entry` (`id`, `source_id`, `type`, `heading`, `start`, `end`, `all_day`, `status`, `recurring_entry_id`, `recurrence_id`, `uid`) values (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
			['tidy-override', server.source.id, 'task', 'Tidy the desk properly', third, third + 1_200_000, 'done', id, third, stored!.uid])
		const routine = await routineOf('Tidy the desk')
		assert.deepEqual(routine.occurrences.filter(occurrence => occurrence.status !== 'open').map(occurrence => occurrence.status), ['missed', 'missed', 'kept', 'missed'])
	})

	it('answers as many of the last dates as asked, the next date\'s routine first', async () => {
		await weekly('Read', EntryType.Task)
		assert.ok((await routines({ last: 2 })).every(routine => routine.occurrences.length <= 2))
		const nexts = (await routines()).map(routine => routine.next?.start ? Date.parse(routine.next.start) : Infinity)
		assert.deepEqual(nexts, nexts.toSorted((a, b) => a - b))
	})
})
