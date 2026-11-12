import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryStatus, EntryType } from '#features/entries'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { Recurrence, EntryOccurrence, RecurrenceFrequency } from '#features/recurrence'
import { Routines } from './Routines.js'
import { RoutineCadence, type RoutineUnit } from '../RoutineCadence.js'
import { Routine } from '../Routine.js'

describe('Routines', () => {
	const base = new DateTime().dayStart

	const days = (count: number, from = 0) => Array.from({ length: count }, (_, index) => base.add({ days: from + index }))

	/** The routines as `GET /routines` lists them, each coming every so many days. */
	const routines = (cadences: Record<string, number>): ReadonlyMap<string, Routine> => new Map(Object.entries(cadences).map(([id, days]) => [id, new Routine({ id, cadence: new RoutineCadence(days) })]))

	/** A one-off entry as the views get it. */
	const shown = (entry: Entry) => entry.occurrences.single

	/** A recurring entry's occurrences on the given days, in `routineId`. */
	const series = (id: string, routineId: string | undefined, dayOffsets: ReadonlyArray<number>, heading = id) => {
		const at = (offset: number, hours: number) => base.add({ days: offset, hours })
		const recurring = new Entry({ id, sourceId: 'cal', heading, routineId, start: at(dayOffsets[0] ?? 0, 9), end: at(dayOffsets[0] ?? 0, 10), recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		return dayOffsets.map(offset => new EntryOccurrence(recurring, at(offset, 9), at(offset, 10), undefined, at(offset, 9), recurring))
	}

	const detached = (heading: string, offset: number, routineId?: string, init: Partial<Entry> = {}) =>
		shown(new Entry({ id: `loose-${heading}-${offset}`, sourceId: 'cal', heading, routineId, start: base.add({ days: offset, hours: 21 }), end: base.add({ days: offset, hours: 22 }), ...init }))

	const every = (stride: number, count: number, from = 0) => Array.from({ length: count }, (_, index) => from + Math.round(index * stride))

	/** Whether a routine of `cadence` days collapses in rows of `unit`. */
	const collapsesAt = (cadence: number, unit: RoutineUnit) => {
		const occurrences = series('routine', 'r', every(cadence, 6))
		return Routines.of(occurrences, days(500), unit, routines({ r: cadence })).collapses(occurrences[0]!)
	}

	describe('collapses (the density rule)', () => {
		it('never collapses an entry that belongs to no routine', () => {
			const plain = shown(new Entry({ heading: 'Dentist', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) }))
			assert.equal(Routines.of([plain], days(500), 'month', routines({})).collapses(plain), false)
		})

		it('never collapses one whose routine it was not told about', () => {
			const occurrences = series('gym', 'unknown', every(2, 20))
			assert.equal(Routines.of(occurrences, days(500), 'month', routines({})).collapses(occurrences[0]!), false)
		})

		it('keeps a yearly routine: one instance a year is what a year view is for', () => {
			assert.equal(collapsesAt(365, 'month'), false)
		})

		it('collapses a monthly routine in month units, with the slack over a month row, but keeps it in week units', () => {
			assert.equal(collapsesAt(30.436875, 'month'), true)
			assert.equal(collapsesAt(30.436875, 'week'), false)
		})

		it('keeps a quarterly routine in month units, since it is sparser than the slack', () => {
			assert.equal(collapsesAt(91, 'month'), false)
		})

		it('collapses the haircut, about every five weeks, in month units only', () => {
			assert.equal(collapsesAt(35, 'month'), true)
			assert.equal(collapsesAt(35, 'week'), false)
		})

		it('holds the cadence boundary: exactly one per row unit is not denser than the row', () => {
			assert.equal(collapsesAt(7, 'week'), false)
			assert.equal(collapsesAt(7, 'month'), true)
			assert.equal(collapsesAt(3.5, 'week'), true)
		})

		it('collapses an every-2-days routine in both units', () => {
			assert.equal(collapsesAt(2, 'month'), true)
			assert.equal(collapsesAt(2, 'week'), true)
		})

		it('collapses a member however few of its dates the window holds: membership is stored, not counted', () => {
			const occurrences = series('gym', 'r', [0, 2])
			assert.equal(Routines.of(occurrences, days(500), 'month', routines({ r: 2 })).collapses(occurrences[0]!), true)
		})

		it('counts an override as its recurring entry\'s, rule-less as it is', () => {
			const [first] = series('gym', 'r', [0])
			const override = new EntryOccurrence(new Entry({ id: 'gym-moved', heading: 'Gym', start: base.add({ days: 3, hours: 18 }), recurringEntryId: 'gym', recurrenceId: base.add({ days: 2, hours: 9 }) }), base.add({ days: 3, hours: 18 }), base.add({ days: 3, hours: 19 }), undefined, base.add({ days: 2, hours: 9 }), first!.recurringEntry)
			assert.equal(Routines.of([first!, override], days(500), 'month', routines({ r: 2 })).collapses(override), true)
		})

		it('never collapses a recurring entry whose rule yields nothing, shown once as its own', () => {
			const master = shown(new Entry({ id: 'm', sourceId: 'cal', heading: 'Gym', routineId: 'r', start: base.add({ days: 51, hours: 21 }), end: base.add({ days: 51, hours: 22 }), recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) }))
			assert.equal(Routines.of([master], days(500), 'month', routines({ r: 2 })).collapses(master), false)
		})

		it('never collapses a move ghost, so a drag shows its bar', () => {
			const loose = detached('Gym', 51, 'r')
			EntryStore.pending.setPreview(loose.entry)
			try {
				const cohort = Routines.of([...series('gym', 'r', every(2, 40)), loose], days(500), 'month', routines({ r: 2 }))
				assert.equal(cohort.collapses(loose), false)
				assert.equal(cohort.kept.includes(loose), true)
			} finally {
				EntryStore.pending.setPreview(undefined)
			}
		})

		it('collapses a routine whose every occurrence was ticked off as a row of its own, never drawing those as bars', () => {
			const pills = Array.from({ length: 60 }, (_, index) => detached('Pills', index, 'r', { type: EntryType.Task, status: EntryStatus.Done }))
			for (const unit of ['month', 'week'] as const) {
				const cohort = Routines.of(pills, days(500), unit, routines({ r: 1 }))
				assert.equal(pills.every(occurrence => cohort.collapses(occurrence)), true)
				assert.deepEqual(cohort.kept, [])
				assert.equal(cohort.runsIn(base, base.add({ days: 59 }))[0]!.days.length, 60)
			}
		})
	})

	describe('kept', () => {
		it('hands back the very same array when nothing collapses', () => {
			const occurrences = series('birthday', 'r', [0, 365])
			assert.equal(Routines.of(occurrences, days(500), 'month', routines({ r: 365 })).kept, occurrences)
		})

		it('drops the collapsed routine\'s occurrences and nothing else', () => {
			const plain = shown(new Entry({ heading: 'Dentist', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) }))
			assert.deepEqual(Routines.of([...series('gym', 'r', every(2, 50)), plain], days(500), 'month', routines({ r: 2 })).kept, [plain])
		})
	})

	describe('runsIn', () => {
		const gym = (count: number, from = 0) => series('gym', 'r', every(2, count, from), 'Gym')
		const cohort = (occurrences: ReadonlyArray<EntryOccurrence>, cadences: Record<string, number> = { r: 2 }) => Routines.of(occurrences, days(500), 'month', routines(cadences))
		const dayOffsets = (run: { days: ReadonlyArray<number> }) => run.days.map(day => Math.round((day - base.dayStart.valueOf()) / 86_400_000))

		it('yields nothing for a routine this view keeps', () => {
			assert.deepEqual(cohort(series('birthday', 'r', [0, 365]), { r: 365 }).runsIn(base, base.add({ days: 60 })), [])
		})

		it('yields one run per routine, carrying every day it falls on in range', () => {
			const runs = cohort(gym(100)).runsIn(base.add({ days: 10 }), base.add({ days: 20 }))
			assert.equal(runs.length, 1)
			assert.deepEqual(dayOffsets(runs[0]!), [10, 12, 14, 16, 18, 20])
			assert.equal(runs[0]!.segment.entry.heading, 'Gym')
		})

		it('pulls a row ticked off its recurring entry into the run on its own day', () => {
			const runs = cohort([...gym(100), detached('Gym', 51, 'r')]).runsIn(base.add({ days: 48 }), base.add({ days: 54 }))
			assert.deepEqual(dayOffsets(runs[0]!), [48, 50, 51, 52, 54])
		})

		it('draws twin recurring entries of one routine as one run', () => {
			const twin = series('gym-evening', 'r', every(2, 100), 'Gym')
			assert.equal(cohort([...gym(100), ...twin]).runsIn(base, base.add({ days: 40 })).length, 1)
		})

		it('leaves days outside the window out', () => {
			assert.deepEqual(cohort(gym(100, 600)).runsIn(base, base.add({ days: 800 })), [])
		})

		it('leaves a lapse as a hole in the days, with no run of its own', () => {
			const runs = cohort([...gym(8), ...gym(8, 40)]).runsIn(base, base.add({ days: 80 }))
			assert.equal(runs.length, 1)
			assert.deepEqual(dayOffsets(runs[0]!), [0, 2, 4, 6, 8, 10, 12, 14, 40, 42, 44, 46, 48, 50, 52, 54])
		})

		it('marks a twice-daily routine once per day: a duplicate day collapses the ribbon', () => {
			const twiceDaily = Array.from({ length: 20 }, (_, index) => index).flatMap(offset => [
				detached('Pills', offset, 'p'),
				shown(new Entry({ id: `pills-pm-${offset}`, sourceId: 'cal', heading: 'Pills', routineId: 'p', start: base.add({ days: offset, hours: 20 }), end: base.add({ days: offset, hours: 20, minutes: 5 }) })),
			])
			const runs = cohort(twiceDaily, { p: 1 }).runsIn(base, base.add({ days: 4 }))
			assert.deepEqual(dayOffsets(runs[0]!), [0, 1, 2, 3, 4])
		})

		it('orders runs by start so the lane packing is deterministic', () => {
			const late = series('standup', 's', every(1, 30, 5), 'Standup')
			const runs = cohort([...late, ...gym(30)], { r: 2, s: 1 }).runsIn(base, base.add({ days: 40 }))
			assert.deepEqual(runs.map(run => run.segment.entry.heading), ['Gym', 'Standup'])
		})
	})

	describe('of (memoisation)', () => {
		it('reuses the cohort for the same inputs and rebuilds when any of them change', () => {
			const occurrences = series('gym', 'r', every(2, 100))
			const window = days(500)
			const known = routines({ r: 2 })
			const cohort = Routines.of(occurrences, window, 'month', known)
			assert.equal(Routines.of(occurrences, window, 'month', known), cohort)
			assert.notEqual(Routines.of(occurrences, window, 'week', known), cohort)
			assert.notEqual(Routines.of([...occurrences], window, 'month', known), cohort)
			assert.notEqual(Routines.of(occurrences, days(500), 'month', known), cohort)
			assert.notEqual(Routines.of(occurrences, window, 'month', routines({ r: 2 })), cohort)
		})
	})
})
