import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Entry, EntryType, EntryPatch, EntryStatus } from '#features/entries'
import { Recurrence, RecurrenceFrequency, RecurrenceWeekday, EntryOccurrenceChangeScope } from '#features/recurrence'
import { shown, viewIn, zones, midnight } from '#features/entries/server/viewers.testing.js'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { UpdateEntryOccurrence } from '#features/entries/server/UpdateEntryOccurrence.js'
import { CompleteTask } from '#features/entries/server/CompleteTask.js'
import { CreateSource } from '#features/sources/server/CreateSource.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { ListRoutines } from './server/ListRoutines.js'
import { Routines } from './client/Routines.js'
import type { RoutineUnit } from './RoutineCadence.js'

/*
	What the month and year views collapsed before routines were stored, kept as what they must still collapse: the cases
	of the detector that read a view's window, each now written to a server, recognized there, and read back as a browser
	does. A case that only described the window is gone, as nothing depends on it any more.
*/
describe('What the views collapse, from the entries written to what a browser draws', () => {
	let server: OperationServer
	let calendar: string
	before(async () => {
		server = await OperationServer.start()
		viewIn(zones.berlin)
	})
	after(() => server.close())
	beforeEach(async () => {
		calendar = (await CreateSource.call({ id: server.integration.id, name: crypto.randomUUID() })).id
	})

	const at = (day: number, hour = 9) => midnight('2026-03-02').add({ days: day, hours: hour })
	const create = (heading: string, init: Partial<Entry> = {}) => CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: calendar, type: EntryType.Event, heading, start: at(0), end: at(0, 10), ...init })))
	const repeating = (heading: string, recurrence: Recurrence, init: Partial<Entry> = {}) => create(heading, { recurrence, ...init })
	const once = (heading: string, day: number, init: Partial<Entry> = {}) => create(heading, { start: at(day, 21), end: at(day, 22), ...init })

	const daily = (every = 1, count?: number) => new Recurrence({ freq: RecurrenceFrequency.Daily, interval: every > 1 ? every : undefined, count })
	const weekly = (byday?: Array<string>, every?: number) => new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: byday?.map(code => RecurrenceWeekday.parse(code)!), interval: every })
	const monthly = () => new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: 2 })
	const yearly = () => new Recurrence({ freq: RecurrenceFrequency.Yearly })

	/** The titles of this calendar whose entries collapse in rows of `unit`, over the window such a view fetches. */
	const collapsedIn = async (unit: RoutineUnit) => {
		const occurrences = (await shown('2026-03-01', unit === 'month' ? '2027-07-14' : '2026-08-02')).filter(occurrence => occurrence.entry.sourceId === calendar)
		const routines = new Map((await ListRoutines.call()).map(routine => [routine.id, routine]))
		const cohort = Routines.of(occurrences, [], unit, routines)
		return [...new Set(occurrences.filter(occurrence => cohort.collapses(occurrence)).map(occurrence => occurrence.entry.heading.trim().toLowerCase()))].sort()
	}

	describe('the density rule', () => {
		it('never collapses an entry that belongs to no routine', async () => {
			await once('Dentist', 3)
			assert.deepEqual(await collapsedIn('month'), [])
		})

		it('keeps a yearly series: one instance a year is what a year view is for', async () => {
			await repeating('Birthday', yearly())
			assert.deepEqual(await collapsedIn('month'), [])
		})

		it('collapses a monthly series in month units, kept in week units', async () => {
			await repeating('Rent', monthly())
			assert.deepEqual(await collapsedIn('month'), ['rent'])
			assert.deepEqual(await collapsedIn('week'), [])
		})

		it('keeps a quarterly series in month units, since it is sparser than the slack', async () => {
			await repeating('Review', weekly(undefined, 13))
			assert.deepEqual(await collapsedIn('month'), [])
		})

		it('collapses a weekly series in month units, and keeps it in week units: one bar per week row', async () => {
			await repeating('Sync', weekly())
			assert.deepEqual(await collapsedIn('month'), ['sync'])
			assert.deepEqual(await collapsedIn('week'), [])
		})

		it('collapses a biweekly series in month units but keeps it in week units', async () => {
			await repeating('Payday', weekly(undefined, 2))
			assert.deepEqual(await collapsedIn('month'), ['payday'])
			assert.deepEqual(await collapsedIn('week'), [])
		})

		it('collapses an every-2-days habit in both units', async () => {
			await repeating('Gym', daily(2))
			assert.deepEqual(await collapsedIn('month'), ['gym'])
			assert.deepEqual(await collapsedIn('week'), ['gym'])
		})

		it('collapses a twice-weekly BYDAY series in both units, since the list divides the stride', async () => {
			await repeating('Volleyball', weekly(['MO', 'WE']))
			assert.deepEqual(await collapsedIn('month'), ['volleyball'])
			assert.deepEqual(await collapsedIn('week'), ['volleyball'])
		})

		it('collapses even a short daily burst', async () => {
			await repeating('Accounting', daily(1, 5))
			assert.deepEqual(await collapsedIn('month'), ['accounting'])
			assert.deepEqual(await collapsedIn('week'), ['accounting'])
		})

		it('holds the evidence floor: three dates are an incident, four a routine', async () => {
			await repeating('Three', daily(1, 3))
			await repeating('Four', daily(1, 4))
			assert.deepEqual(await collapsedIn('month'), ['four'])
			assert.deepEqual(await collapsedIn('week'), ['four'])
		})

		it('holds the cadence boundary: exactly one per row unit is not denser than the row', async () => {
			await repeating('Sync', weekly())
			await repeating('Twice', weekly(['MO', 'TH']))
			assert.deepEqual(await collapsedIn('week'), ['twice'])
		})

		it('counts an override as a date of its routine, whatever it was renamed to', async () => {
			const { id } = await repeating('Gym', daily(2))
			const [, second] = (await shown('2026-03-01', '2026-03-20')).filter(occurrence => occurrence.recurringEntryId === id)
			const edited = second!.override()
			edited.heading = 'Gym with a friend'
			const occurrence = second!.recurringEntry!.occurrences.overriddenBy(edited)
			await UpdateEntryOccurrence.call({ ...EntryPatch.of(occurrence.entry, EntryPatch.occurrence), id: id!, occurrence: occurrence.storedRecurrenceId!, scope: EntryOccurrenceChangeScope.This })
			assert.deepEqual(await collapsedIn('month'), ['gym', 'gym with a friend'])
		})

		it('judges every routine on its own', async () => {
			await repeating('Gym', daily(2))
			await repeating('Birthday', yearly())
			assert.deepEqual(await collapsedIn('month'), ['gym'])
		})
	})

	describe('pooling (a routine sits a layer above recurrence)', () => {
		it('keeps an occurrence ticked off its recurring task in the routine, as a row of its own', async () => {
			const { id } = await repeating('Gym', daily(2), { type: EntryType.Task })
			await CompleteTask.call({ id: id!, occurrence: at(4) })
			const done = (await shown('2026-03-01', '2026-03-20')).filter(occurrence => occurrence.entry.sourceId === calendar && occurrence.entry.status === EntryStatus.Done)
			assert.equal(done.length, 1)
			const routines = new Map((await ListRoutines.call()).map(routine => [routine.id, routine]))
			assert.equal(Routines.of(done, [], 'month', routines).collapses(done[0]!), true)
		})

		it('pools twin series wearing the same title into one routine: morning and evening pills are one habit', async () => {
			await repeating('Pills', daily())
			await repeating('Pills', daily(), { start: at(0, 20), end: at(0, 21) })
			await once('Pills', 51)
			assert.deepEqual(await collapsedIn('month'), ['pills'])
			const routines = await server.query<{ id: string }>('select id from routine where source_id = ?', [calendar])
			assert.equal(routines.length, 1)
		})

		it('pools one habit split across several weekly series: Sat/Tue/Thu volleyball is one routine', async () => {
			for (const weekday of ['TU', 'TH', 'SA']) {
				await repeating('Volleyball', weekly([weekday]))
			}
			// Each alone is weekly, kept in week units; together they come every other day or so.
			assert.deepEqual(await collapsedIn('week'), ['volleyball'])
			assert.deepEqual(await collapsedIn('month'), ['volleyball'])
		})

		it('weighs all entries of a title against the floor together, as one routine', async () => {
			await repeating('Gym', daily(2, 3))
			assert.deepEqual(await collapsedIn('month'), [])
			for (const day of [6, 8, 10]) {
				await once('Gym', day)
			}
			assert.deepEqual(await collapsedIn('month'), ['gym'])
		})

		it('collapses a routine whose every occurrence was ticked off as an entry of its own', async () => {
			for (let day = 0; day < 30; day++) {
				await once('Pills', day, { type: EntryType.Task, status: EntryStatus.Done })
			}
			assert.deepEqual(await collapsedIn('month'), ['pills'])
			assert.deepEqual(await collapsedIn('week'), ['pills'])
		})

		it('collapses an unruled five-weekly habit in month units (the haircut) but keeps it in week units', async () => {
			for (let index = 0; index < 10; index++) {
				await once('Haircut', index * 35)
			}
			assert.deepEqual(await collapsedIn('month'), ['haircut'])
			assert.deepEqual(await collapsedIn('week'), [])
		})

		it('leaves same-named one-offs alone when there is no density to speak of', async () => {
			for (const day of [0, 40, 95, 160]) {
				await once('Lunch', day)
			}
			assert.deepEqual(await collapsedIn('month'), [])
		})

		it('leaves them alone when there are many but sparser than the slack', async () => {
			for (let index = 0; index < 11; index++) {
				await once('Review', index * 45)
			}
			assert.deepEqual(await collapsedIn('month'), [])
		})

		it('leaves a differently-named entry alone', async () => {
			await repeating('Gym', daily(2))
			await once('Dentist', 51)
			assert.deepEqual(await collapsedIn('month'), ['gym'])
		})

		it('leaves the same name in another calendar alone', async () => {
			await repeating('Gym', daily(2))
			const elsewhere = await once('Gym', 51, { sourceId: server.source.id })
			const [row] = await server.query<{ routine_id: string | null }>('select routine_id from entry where id = ?', [elsewhere.id])
			assert.equal(row!.routine_id, null)
		})

		it('pools an all-day placeholder with its timed routine: an unscheduled appointment is the same habit', async () => {
			await repeating('Gym', daily(2))
			const placeholder = await once('Gym', 51, { allDay: true, start: midnight('2026-04-22'), end: midnight('2026-04-23') })
			const [row] = await server.query<{ routine_id: string | null }>('select routine_id from entry where id = ?', [placeholder.id])
			assert.ok(row!.routine_id)
		})

		it('matches regardless of case and surrounding space', async () => {
			await repeating('Gym', daily(2))
			await once('  gym  ', 51)
			assert.deepEqual(await collapsedIn('month'), ['gym'])
		})

		it('ignores a blank heading rather than matching everything', async () => {
			await repeating('', daily(2))
			const blank = await once('', 51)
			const [row] = await server.query<{ routine_id: string | null }>('select routine_id from entry where id = ?', [blank.id])
			assert.equal(row!.routine_id, null)
		})
	})
})
