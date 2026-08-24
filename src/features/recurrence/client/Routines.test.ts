import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../../entries/Entry.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { Recurrence } from '../Recurrence.js'
import { Routines, type RoutineUnit } from './Routines.js'

describe('Routines', () => {
	const base = new DateTime().dayStart

	const days = (count: number, from = 0) => Array.from({ length: count }, (_, index) => base.add({ days: from + index }))

	const series = (id: string, recurrence: Recurrence, dayOffsets: ReadonlyArray<number>, heading = id, sourceId = 'cal') =>
		dayOffsets.map(offset => new Entry({
			id: `${id}__${offset}`,
			sourceId,
			heading,
			start: base.add({ days: offset, hours: 9 }),
			end: base.add({ days: offset, hours: 10 }),
			recurrence,
			recurrenceMasterId: id,
		}))

	const detached = (heading: string, offset: number, sourceId = 'cal', init: Partial<Entry> = {}) =>
		new Entry({
			id: `loose-${heading}-${offset}`,
			sourceId,
			heading,
			start: base.add({ days: offset, hours: 21 }),
			end: base.add({ days: offset, hours: 22 }),
			...init,
		})

	const cadence = (recurrence: Recurrence, count: number, from = 0) =>
		Array.from({ length: count }, (_, index) => from + Math.round(index * recurrence.strideDays))

	const daily = (every = 1) => new Recurrence({ freq: 'DAILY', interval: every > 1 ? every : undefined })
	const weekly = (byday?: Array<string>, every?: number) => new Recurrence({ freq: 'WEEKLY', byday, interval: every })
	const monthly = () => new Recurrence({ freq: 'MONTHLY', bymonthday: base.day })
	const yearly = () => new Recurrence({ freq: 'YEARLY' })

	const collapsedIn = (unit: RoutineUnit, entries: ReadonlyArray<Entry>, windowDays = unit === 'month' ? 500 : 154) => {
		const cohort = Routines.of(entries, days(windowDays), unit)
		return new Set(entries.filter(entry => cohort.collapses(entry)).map(entry => entry.recurrenceMasterId))
	}

	describe('collapses (the density rule)', () => {
		it('never collapses an entry that belongs to no series', () => {
			const plain = new Entry({ heading: 'Dentist', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			assert.equal(Routines.of([plain], days(500), 'month').collapses(plain), false)
		})

		it('keeps a yearly series — one instance a year is what a year view is for', () => {
			assert.deepEqual(collapsedIn('month', series('birthday', yearly(), cadence(yearly(), 2))), new Set())
		})

		it('keeps a monthly series in month units: one bar per row is the budget, not over it', () => {
			assert.deepEqual(collapsedIn('month', series('rent', monthly(), cadence(monthly(), 16))), new Set())
		})

		it('collapses a weekly series in month units', () => {
			assert.deepEqual(collapsedIn('month', series('sync', weekly(), cadence(weekly(), 60))), new Set(['sync']))
		})

		it('keeps that same weekly series in week units — one bar per week row', () => {
			assert.deepEqual(collapsedIn('week', series('sync', weekly(), cadence(weekly(), 20))), new Set())
		})

		it('collapses a biweekly series in month units but keeps it in week units', () => {
			const rule = weekly(undefined, 2)
			assert.deepEqual(collapsedIn('month', series('payday', rule, cadence(rule, 30))), new Set(['payday']))
			assert.deepEqual(collapsedIn('week', series('payday', rule, cadence(rule, 10))), new Set())
		})

		it('collapses an every-2-days habit in both units', () => {
			const rule = daily(2)
			assert.deepEqual(collapsedIn('month', series('gym', rule, cadence(rule, 200))), new Set(['gym']))
			assert.deepEqual(collapsedIn('week', series('gym', rule, cadence(rule, 60))), new Set(['gym']))
		})

		it('collapses a twice-weekly BYDAY series in both units — the list divides the stride', () => {
			const rule = weekly(['MO', 'WE'])
			const offsets = Array.from({ length: 40 }, (_, index) => Math.floor(index / 2) * 7 + (index % 2) * 2)
			assert.deepEqual(collapsedIn('month', series('volleyball', rule, offsets)), new Set(['volleyball']))
			assert.deepEqual(collapsedIn('week', series('volleyball', rule, offsets.slice(0, 20))), new Set(['volleyball']))
		})

		it('keeps a five-day burst in both units — dense, but too few to be wallpaper', () => {
			const burst = series('accounting', daily(), [0, 1, 2, 3, 4])
			assert.deepEqual(collapsedIn('month', burst), new Set())
			assert.deepEqual(collapsedIn('week', burst), new Set())
		})

		it('collapses a three-week daily crunch in both units', () => {
			const crunch = series('crunch', daily(), cadence(daily(), 21))
			assert.deepEqual(collapsedIn('month', crunch), new Set(['crunch']))
			assert.deepEqual(collapsedIn('week', crunch), new Set(['crunch']))
		})

		it('holds the instance-count boundary: exactly one per row keeps, one more collapses', () => {
			assert.deepEqual(collapsedIn('month', series('twelve', daily(), cadence(daily(), 12))), new Set())
			assert.deepEqual(collapsedIn('month', series('thirteen', daily(), cadence(daily(), 13))), new Set(['thirteen']))
			assert.deepEqual(collapsedIn('week', series('five', daily(), cadence(daily(), 5))), new Set())
			assert.deepEqual(collapsedIn('week', series('six', daily(), cadence(daily(), 6))), new Set(['six']))
		})

		it('holds the cadence boundary: exactly one per row unit is not denser than the row', () => {
			assert.deepEqual(collapsedIn('week', series('sync', weekly(), cadence(weekly(), 20))), new Set())
			assert.deepEqual(collapsedIn('week', series('twice', weekly(['MO', 'TH']), cadence(weekly(['MO', 'TH']), 20))), new Set(['twice']))
		})

		it('counts a synced override as an instance of its series, rule-less as it is', () => {
			const rule = daily(2)
			const instances = series('gym', rule, cadence(rule, 13))
			const override = new Entry({ id: 'gym-moved', heading: 'Gym', start: base.add({ days: 27, hours: 18 }), end: base.add({ days: 27, hours: 19 }), recurrenceMasterId: 'gym', recurrenceId: base.add({ days: 26, hours: 9 }) })
			const cohort = Routines.of([...instances, override], days(500), 'month')
			assert.equal(cohort.collapses(override), true)
			assert.equal(cohort.collapses(instances[0]!), true)
		})

		it('judges every series on its own', () => {
			const dense = series('gym', daily(2), cadence(daily(2), 100))
			const sparse = series('rent', monthly(), cadence(monthly(), 16))
			assert.deepEqual(collapsedIn('month', [...dense, ...sparse]), new Set(['gym']))
		})

		it('ignores instances outside the rendered window', () => {
			const far = series('gym', daily(2), cadence(daily(2), 100, 600))
			assert.deepEqual(collapsedIn('month', far), new Set())
		})

		it('ignores a move ghost, so a dragged instance is not counted twice', () => {
			const instances = series('gym', daily(2), cadence(daily(2), 13))
			const ghost = new Entry({ heading: 'Gym', start: base.add({ days: 40, hours: 9 }), end: base.add({ days: 40, hours: 10 }), recurrence: daily(2), recurrenceMasterId: 'gym' })
			EntryStore.setPreview(ghost)
			try {
				const cohort = Routines.of([...instances, ghost], days(500), 'month')
				assert.equal(cohort.collapses(instances[0]!), true)
				assert.equal(cohort.kept.includes(ghost), true)
			} finally {
				EntryStore.setPreview(undefined)
			}
		})
	})

	describe('kept', () => {
		it('hands back the very same array when nothing collapses', () => {
			const entries = series('rent', monthly(), cadence(monthly(), 16))
			assert.equal(Routines.of(entries, days(500), 'month').kept, entries)
		})

		it('drops the collapsed series\' instances and nothing else', () => {
			const dense = series('gym', daily(2), cadence(daily(2), 100))
			const plain = new Entry({ heading: 'Dentist', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const kept = Routines.of([...dense, plain], days(500), 'month').kept
			assert.deepEqual(kept, [plain])
		})
	})

	describe('detached occurrences', () => {
		const gym = (count = 100) => series('gym', daily(2), cadence(daily(2), count), 'Gym')

		it('pulls a detached occurrence back into its routine', () => {
			const loose = detached('Gym', 51)
			const cohort = Routines.of([...gym(), loose], days(500), 'month')
			assert.equal(cohort.collapses(loose), true)
			assert.equal(cohort.kept.includes(loose), false)
		})

		it('draws it as a mark on its OWN day, not the day it was detached from', () => {
			const loose = detached('Gym', 51)
			const runs = Routines.of([...gym(), loose], days(500), 'month').runsIn(base.add({ days: 48 }), base.add({ days: 54 }))
			const offsets = runs[0]!.days.map(day => Math.round((day - base.dayStart.valueOf()) / 86_400_000))
			assert.deepEqual(offsets, [48, 50, 51, 52, 54])
		})

		it('leaves a differently-named entry alone', () => {
			const other = detached('Dentist', 51)
			const cohort = Routines.of([...gym(), other], days(500), 'month')
			assert.equal(cohort.collapses(other), false)
			assert.equal(cohort.kept.includes(other), true)
		})

		it('leaves the same name in another calendar alone', () => {
			const elsewhere = detached('Gym', 51, 'other-cal')
			assert.equal(Routines.of([...gym(), elsewhere], days(500), 'month').collapses(elsewhere), false)
		})

		it('will not match an all-day entry to a timed routine', () => {
			const allDayGym = detached('Gym', 51, 'cal', { allDay: true })
			assert.equal(Routines.of([...gym(), allDayGym], days(500), 'month').collapses(allDayGym), false)
		})

		it('matches regardless of case and surrounding space', () => {
			const loose = detached('  gym  ', 51)
			assert.equal(Routines.of([...gym(), loose], days(500), 'month').collapses(loose), true)
		})

		it('joins only a series that ALREADY collapses — a one-off cannot tip the threshold', () => {
			const sparse = series('gym', daily(2), cadence(daily(2), 12), 'Gym')
			const loose = detached('Gym', 51)
			const cohort = Routines.of([...sparse, loose], days(500), 'month')
			assert.equal(cohort.collapses(loose), false)
			assert.equal(cohort.collapses(sparse[0]!), false)
		})

		it('never adopts an entry that belongs to another series, or a series master', () => {
			const otherSeries = series('standup', daily(), cadence(daily(), 40), 'Gym')
			const master = new Entry({ id: 'm', sourceId: 'cal', heading: 'Gym', start: base.add({ days: 51, hours: 21 }), end: base.add({ days: 51, hours: 22 }), recurrence: daily(2) })
			const cohort = Routines.of([...gym(), ...otherSeries, master], days(500), 'month')
			assert.equal(cohort.collapses(master), false)
			assert.equal(cohort.collapses(otherSeries[0]!), true)
			assert.equal(cohort.runsIn(base, base.add({ days: 400 })).length, 2)
		})

		it('ignores a blank heading rather than matching everything', () => {
			const blank = detached('', 51)
			const blankSeries = series('mystery', daily(2), cadence(daily(2), 100), '')
			assert.equal(Routines.of([...blankSeries, blank], days(500), 'month').collapses(blank), false)
		})

		it('never adopts a move ghost', () => {
			const loose = detached('Gym', 51)
			EntryStore.setPreview(loose)
			try {
				const cohort = Routines.of([...gym(), loose], days(500), 'month')
				assert.equal(cohort.collapses(loose), false)
				assert.equal(cohort.kept.includes(loose), true)
			} finally {
				EntryStore.setPreview(undefined)
			}
		})

		it('ignores one outside the rendered window', () => {
			const far = detached('Gym', 600)
			assert.equal(Routines.of([...gym(), far], days(500), 'month').collapses(far), false)
		})

		it('adopts in the week unit too, and only where that unit collapses', () => {
			const looseDense = detached('Gym', 5)
			assert.equal(Routines.of([...gym(60), looseDense], days(154), 'week').collapses(looseDense), true)
			const weeklySeries = series('sync', weekly(), cadence(weekly(), 20), 'Sync')
			const looseSync = detached('Sync', 5)
			assert.equal(Routines.of([...weeklySeries, looseSync], days(154), 'week').collapses(looseSync), false)
		})
	})

	describe('runsIn', () => {
		const gymRule = daily(2)
		const gym = (count: number, from = 0) => series('gym', gymRule, cadence(gymRule, count, from), 'Gym')

		it('yields nothing for a series this view keeps', () => {
			const cohort = Routines.of(series('rent', monthly(), cadence(monthly(), 16)), days(500), 'month')
			assert.deepEqual(cohort.runsIn(base, base.add({ days: 60 })), [])
		})

		const dayOffsets = (run: { days: ReadonlyArray<number> }) =>
			run.days.map(day => Math.round((day - base.dayStart.valueOf()) / 86_400_000))

		it('yields one run per collapsed series, carrying every day it falls on in range', () => {
			const cohort = Routines.of(gym(100), days(500), 'month')
			const runs = cohort.runsIn(base.add({ days: 10 }), base.add({ days: 20 }))
			assert.equal(runs.length, 1)
			assert.deepEqual(dayOffsets(runs[0]!), [10, 12, 14, 16, 18, 20])
			assert.equal(runs[0]!.segment.entry.heading, 'Gym')
		})

		it('carries only the days inside the queried row', () => {
			const cohort = Routines.of(gym(100), days(500), 'month')
			const runs = cohort.runsIn(base.add({ days: 3 }), base.add({ days: 7 }))
			assert.deepEqual(dayOffsets(runs[0]!), [4, 6])
		})

		it('leaves a lapse as a hole in the days, with no run of its own', () => {
			const lapsed = [...gym(8), ...gym(8, 40)]
			const runs = Routines.of(lapsed, days(500), 'month').runsIn(base, base.add({ days: 80 }))
			assert.equal(runs.length, 1)
			assert.deepEqual(dayOffsets(runs[0]!), [0, 2, 4, 6, 8, 10, 12, 14, 40, 42, 44, 46, 48, 50, 52, 54])
		})

		it('keeps a single missed occurrence as a missing day', () => {
			const withExdate = gym(20).filter((_, index) => index !== 5)
			const runs = Routines.of(withExdate, days(500), 'month').runsIn(base, base.add({ days: 60 }))
			assert.equal(runs.length, 1)
			assert.equal(runs[0]!.days.length, 19)
			assert.equal(dayOffsets(runs[0]!).includes(10), false)
			assert.deepEqual(dayOffsets(runs[0]!).slice(0, 7), [0, 2, 4, 6, 8, 12, 14])
		})

		it('yields a single-day run where only one instance falls in the row', () => {
			const runs = Routines.of(gym(100), days(500), 'month').runsIn(base.add({ days: 10 }), base.add({ days: 10 }))
			assert.equal(runs.length, 1)
			assert.deepEqual(dayOffsets(runs[0]!), [10])
		})

		it('orders runs by start so the lane packing is deterministic', () => {
			const early = series('gym', gymRule, cadence(gymRule, 30), 'Gym')
			const late = series('standup', daily(), cadence(daily(), 30, 5), 'Standup')
			const runs = Routines.of([...late, ...early], days(500), 'month').runsIn(base, base.add({ days: 40 }))
			assert.deepEqual(runs.map(run => run.segment.entry.heading), ['Gym', 'Standup'])
		})
	})

	describe('of (memoisation)', () => {
		it('reuses the cohort for the same inputs and rebuilds when any of them change', () => {
			const entries = series('gym', daily(2), cadence(daily(2), 100))
			const window = days(500)
			const cohort = Routines.of(entries, window, 'month')
			assert.equal(Routines.of(entries, window, 'month'), cohort)
			assert.notEqual(Routines.of(entries, window, 'week'), cohort)
			assert.notEqual(Routines.of([...entries], window, 'month'), cohort)
			assert.notEqual(Routines.of(entries, days(500), 'month'), cohort)
		})
	})
})
