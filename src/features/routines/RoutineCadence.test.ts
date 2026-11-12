import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RoutineCadence } from './RoutineCadence.js'

describe('RoutineCadence', () => {
	const first = Temporal.PlainDate.from('2026-01-05')
	const on = (...offsets: Array<number>) => offsets.map(days => first.add({ days }))

	it('adds rules up: three weekly ones come every 2⅓ days, twice a day is half a day', () => {
		assert.equal(RoutineCadence.of([7, 7, 7])!.days.toFixed(2), '2.33')
		assert.equal(RoutineCadence.of([1, 1])!.days, 0.5)
	})

	it('takes the tighter of the rules and the cadence of entries of their own', () => {
		assert.equal(RoutineCadence.of([7], new RoutineCadence(2))!.days, 2)
		assert.equal(RoutineCadence.of([1], new RoutineCadence(30))!.days, 1)
		assert.equal(RoutineCadence.of([], new RoutineCadence(35))!.days, 35)
	})

	it('is none where neither a rule nor a gap says anything', () => {
		assert.equal(RoutineCadence.of([]), undefined)
	})

	it('collapses in a week row only what comes more often than weekly', () => {
		assert.equal(new RoutineCadence(2).collapsesIn('week'), true)
		assert.equal(new RoutineCadence(7).collapsesIn('week'), false)
	})

	it('collapses in a month row what comes up to about every five weeks', () => {
		assert.equal(new RoutineCadence(30.436875).collapsesIn('month'), true)
		assert.equal(new RoutineCadence(35).collapsesIn('month'), true)
		assert.equal(new RoutineCadence(45).collapsesIn('month'), false)
		assert.equal(new RoutineCadence(365).collapsesIn('month'), false)
	})

	describe('between', () => {
		it('is the middle distance between neighbouring days, each day once', () => {
			assert.equal(RoutineCadence.between(on(0, 2, 3, 5, 5, 9))!.days, 2)
			assert.equal(RoutineCadence.between(on(0, 35, 70, 105))!.days, 35)
		})

		it('is none below two days', () => {
			assert.equal(RoutineCadence.between(on(4)), undefined)
			assert.equal(RoutineCadence.between(on(4, 4)), undefined)
			assert.equal(RoutineCadence.between(on()), undefined)
		})

		it('counts calendar days across a daylight saving change and a year end', () => {
			const days = ['2026-03-28', '2026-03-29', '2026-03-30', '2026-12-31', '2027-01-01'].map(day => Temporal.PlainDate.from(day))
			assert.equal(RoutineCadence.between(days)!.days, 1)
		})
	})

	describe('keptBy', () => {
		const kept = (...offsets: Array<number>) => RoutineCadence.between(on(...offsets))!.keptBy(on(...offsets))

		it('holds for a dense habit kept unevenly, a three-week break included', () => {
			assert.equal(kept(0, 1, 3, 6, 8, 9, 30, 32), true)
		})

		it('holds for monthly dates with a month skipped', () => {
			assert.equal(kept(0, 30, 60, 120, 150), true)
		})

		it('holds where one date came late: it is one day off, not two gaps', () => {
			assert.equal(kept(0, 30, 75, 90, 120), true)
		})

		it('holds for something done about once a year', () => {
			assert.equal(kept(0, 362, 731, 1094), true)
		})

		it('fails where the dates fall anywhere', () => {
			assert.equal(kept(0, 400, 600, 1100, 1500), false)
			assert.equal(kept(0, 10, 200, 230, 700), false)
		})

		it('fails without a day to go by', () => {
			assert.equal(new RoutineCadence(7).keptBy([]), false)
		})
	})
})
