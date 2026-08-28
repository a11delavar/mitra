import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, TaskStatus } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { EntryStore } from '../../entries/client/EntryStore.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
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
		it('never collapses an entry that belongs to no routine', () => {
			const plain = new Entry({ heading: 'Dentist', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			assert.equal(Routines.of([plain], days(500), 'month').collapses(plain), false)
		})

		it('keeps a yearly series — one instance a year is what a year view is for', () => {
			assert.deepEqual(collapsedIn('month', series('birthday', yearly(), cadence(yearly(), 2))), new Set())
		})

		it('collapses a monthly-ish series in month units — the year view orients, and the slack covers cadences just over the row', () => {
			assert.deepEqual(collapsedIn('month', series('rent', monthly(), cadence(monthly(), 16))), new Set(['rent']))
		})

		it('keeps a quarterly series in month units — genuinely sparser than the slack', () => {
			const rule = weekly(undefined, 13)
			assert.deepEqual(collapsedIn('month', series('review', rule, cadence(rule, 6))), new Set())
		})

		it('collapses a weekly series in month units', () => {
			assert.deepEqual(collapsedIn('month', series('sync', weekly(), cadence(weekly(), 60))), new Set(['sync']))
		})

		it('keeps that same weekly series in week units — one bar per week row, no slack in the working view', () => {
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

		it('collapses even a short daily burst — the burst exception was retired (2026-08-28)', () => {
			const burst = series('accounting', daily(), [0, 1, 2, 3, 4])
			assert.deepEqual(collapsedIn('month', burst), new Set(['accounting']))
			assert.deepEqual(collapsedIn('week', burst), new Set(['accounting']))
		})

		it('collapses a three-week daily crunch in both units', () => {
			const crunch = series('crunch', daily(), cadence(daily(), 21))
			assert.deepEqual(collapsedIn('month', crunch), new Set(['crunch']))
			assert.deepEqual(collapsedIn('week', crunch), new Set(['crunch']))
		})

		it('holds the evidence floor: three instances are an incident, four a routine', () => {
			assert.deepEqual(collapsedIn('month', series('three', daily(), cadence(daily(), 3))), new Set())
			assert.deepEqual(collapsedIn('month', series('four', daily(), cadence(daily(), 4))), new Set(['four']))
			assert.deepEqual(collapsedIn('week', series('three', daily(), cadence(daily(), 3))), new Set())
			assert.deepEqual(collapsedIn('week', series('four', daily(), cadence(daily(), 4))), new Set(['four']))
		})

		it('holds the cadence boundary: exactly one per row unit is not denser than the row', () => {
			assert.deepEqual(collapsedIn('week', series('sync', weekly(), cadence(weekly(), 20))), new Set())
			assert.deepEqual(collapsedIn('week', series('twice', weekly(['MO', 'TH']), cadence(weekly(['MO', 'TH']), 20))), new Set(['twice']))
		})

		it('counts a synced override as an instance of its routine, rule-less as it is', () => {
			const rule = daily(2)
			const instances = series('gym', rule, cadence(rule, 13))
			const override = new Entry({ id: 'gym-moved', heading: 'Gym', start: base.add({ days: 27, hours: 18 }), end: base.add({ days: 27, hours: 19 }), recurrenceMasterId: 'gym', recurrenceId: base.add({ days: 26, hours: 9 }) })
			const cohort = Routines.of([...instances, override], days(500), 'month')
			assert.equal(cohort.collapses(override), true)
			assert.equal(cohort.collapses(instances[0]!), true)
		})

		it('judges every routine on its own', () => {
			const dense = series('gym', daily(2), cadence(daily(2), 100))
			const sparse = series('birthday', yearly(), cadence(yearly(), 2))
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
			const entries = series('birthday', yearly(), cadence(yearly(), 2))
			assert.equal(Routines.of(entries, days(500), 'month').kept, entries)
		})

		it('drops the collapsed routine\'s instances and nothing else', () => {
			const dense = series('gym', daily(2), cadence(daily(2), 100))
			const plain = new Entry({ heading: 'Dentist', start: base.add({ hours: 9 }), end: base.add({ hours: 10 }) })
			const kept = Routines.of([...dense, plain], days(500), 'month').kept
			assert.deepEqual(kept, [plain])
		})
	})

	describe('pooling (a routine sits a layer above recurrence)', () => {
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

		it('pools twin series wearing the same appearance into ONE routine — morning and evening pills are one habit', () => {
			const morning = gym()
			const twin = series('gym-evening', daily(2), cadence(daily(2), 100), 'Gym')
			const loose = detached('Gym', 51)
			const cohort = Routines.of([...morning, ...twin, loose], days(500), 'month')
			assert.equal(cohort.collapses(loose), true)
			assert.equal(cohort.collapses(twin[0]!), true)
			assert.equal(cohort.collapses(morning[0]!), true)
			assert.equal(cohort.runsIn(base, base.add({ days: 40 })).length, 1)
		})

		it('pools one habit split across several weekly series — Sat/Tue/Thu volleyball is one routine', () => {
			const weeks = Array.from({ length: 10 }, (_, index) => index * 7)
			const tuesday = series('volley-tu', weekly(['TU']), weeks.map(offset => offset + 1), 'Volleyball')
			const thursday = series('volley-th', weekly(['TH']), weeks.map(offset => offset + 3), 'Volleyball')
			const saturday = series('volley-sa', weekly(['SA']), weeks.map(offset => offset + 5), 'Volleyball')
			// Each member alone is weekly (kept in week units); the pooled cadence is ~2 days (collapses).
			assert.deepEqual(collapsedIn('week', [...tuesday, ...thursday, ...saturday]), new Set(['volley-tu', 'volley-th', 'volley-sa']))
			assert.deepEqual(collapsedIn('month', [...tuesday, ...thursday, ...saturday]), new Set(['volley-tu', 'volley-th', 'volley-sa']))
		})

		it('weighs all members against the floor together, as one routine', () => {
			const rule = daily(2)
			const attached = series('gym', rule, cadence(rule, 3), 'Gym')
			const checkedOff = Array.from({ length: 3 }, (_, index) => detached('Gym', 6 + index * 2))
			assert.equal(Routines.of(attached, days(500), 'month').collapses(attached[0]!), false)
			assert.equal(Routines.of(checkedOff, days(500), 'month').collapses(checkedOff[0]!), false)
			const together = Routines.of([...attached, ...checkedOff], days(500), 'month')
			assert.equal(together.collapses(attached[0]!), true)
			assert.equal(together.collapses(checkedOff[0]!), true)
		})

		it('collapses a routine whose every occurrence in the window was checked off and detached', () => {
			const pills = Array.from({ length: 30 }, (_, index) => detached('Pills', index, 'cal', { type: EntryType.Task, status: TaskStatus.Done }))
			for (const unit of ['month', 'week'] as const) {
				const cohort = Routines.of(pills, days(500), unit)
				assert.equal(pills.every(entry => cohort.collapses(entry)), true)
				assert.deepEqual(cohort.kept, [])
			}
		})

		it('reads the cadence off the days when no occurrence carries a rule at all', () => {
			const overrides = Array.from({ length: 20 }, (_, index) => new Entry({
				id: `standup__${index}`,
				sourceId: 'cal',
				heading: 'Standup',
				start: base.add({ days: index, hours: 9 }),
				end: base.add({ days: index, hours: 10 }),
				recurrenceMasterId: 'standup',
			}))
			assert.deepEqual(collapsedIn('month', overrides), new Set(['standup']))
		})

		it('collapses an unruled five-weekly habit in month units (the haircut) but keeps it in week units', () => {
			const cuts = Array.from({ length: 10 }, (_, index) => detached('Haircut', index * 35))
			const yearly = Routines.of(cuts, days(500), 'month')
			assert.equal(cuts.every(entry => yearly.collapses(entry)), true)
			const monthly = Routines.of(cuts, days(154), 'week')
			assert.equal(cuts.some(entry => monthly.collapses(entry)), false)
		})

		it('leaves same-named one-offs alone when there is no density to speak of', () => {
			const lunches = [0, 40, 95, 160].map(offset => detached('Lunch', offset))
			const cohort = Routines.of(lunches, days(500), 'month')
			assert.equal(lunches.some(entry => cohort.collapses(entry)), false)
			assert.equal(cohort.kept, lunches)
		})

		it('leaves them alone when there are many but sparser than the slack', () => {
			const reviews = Array.from({ length: 14 }, (_, index) => detached('Review', index * 45))
			const cohort = Routines.of(reviews, days(500), 'month')
			assert.equal(reviews.some(entry => cohort.collapses(entry)), false)
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

		it('pools an all-day placeholder with its timed routine — an unscheduled appointment is the same habit', () => {
			const placeholder = detached('Gym', 51, 'cal', { allDay: true })
			assert.equal(Routines.of([...gym(), placeholder], days(500), 'month').collapses(placeholder), true)
		})

		it('matches regardless of case and surrounding space', () => {
			const loose = detached('  gym  ', 51)
			assert.equal(Routines.of([...gym(), loose], days(500), 'month').collapses(loose), true)
		})

		it('never pools a series MASTER row — its occurrences arrive expanded', () => {
			const otherSeries = series('standup', daily(), cadence(daily(), 40), 'Gym')
			const master = new Entry({ id: 'm', sourceId: 'cal', heading: 'Gym', start: base.add({ days: 51, hours: 21 }), end: base.add({ days: 51, hours: 22 }), recurrence: daily(2) })
			const cohort = Routines.of([...gym(), ...otherSeries, master], days(500), 'month')
			assert.equal(cohort.collapses(master), false)
			assert.equal(cohort.collapses(otherSeries[0]!), true)
			// The two same-appearance series pooled into one routine: one run, not two.
			assert.equal(cohort.runsIn(base, base.add({ days: 400 })).length, 1)
		})

		it('ignores a blank heading rather than matching everything', () => {
			const blank = detached('', 51)
			const blankSeries = series('mystery', daily(2), cadence(daily(2), 100), '')
			assert.equal(Routines.of([...blankSeries, blank], days(500), 'month').collapses(blank), false)
		})

		it('never pools a move ghost', () => {
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

		it('pools in the week unit too, and only where that unit collapses', () => {
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

		it('yields nothing for a routine this view keeps', () => {
			const cohort = Routines.of(series('birthday', yearly(), cadence(yearly(), 2)), days(500), 'month')
			assert.deepEqual(cohort.runsIn(base, base.add({ days: 60 })), [])
		})

		const dayOffsets = (run: { days: ReadonlyArray<number> }) =>
			run.days.map(day => Math.round((day - base.dayStart.valueOf()) / 86_400_000))

		it('yields one run per collapsed routine, carrying every day it falls on in range', () => {
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

		it('marks a twice-daily routine once per day — a duplicate day collapses the ribbon', () => {
			const twiceDaily = Array.from({ length: 20 }, (_, index) => index).flatMap(offset => [
				detached('Pills', offset),
				new Entry({ id: `pills-pm-${offset}`, sourceId: 'cal', heading: 'Pills', start: base.add({ days: offset, hours: 20 }), end: base.add({ days: offset, hours: 20, minutes: 5 }) }),
			])
			const runs = Routines.of(twiceDaily, days(500), 'month').runsIn(base, base.add({ days: 4 }))
			assert.equal(runs.length, 1)
			assert.deepEqual(dayOffsets(runs[0]!), [0, 1, 2, 3, 4])
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
