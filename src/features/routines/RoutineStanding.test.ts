import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RoutineStanding } from './RoutineStanding.js'

describe('RoutineStanding', () => {
	/** The standing of dates written as k (kept) and m (missed). */
	const of = (dates: string) => String(RoutineStanding.of([...dates].map(date => date === 'k')))

	it('is starting on fewer than three dates', () => {
		assert.equal(of(''), 'starting')
		assert.equal(of('mm'), 'starting')
	})

	it('is slipping once the last was missed', () => {
		assert.equal(of('kkkkm'), 'slipping')
		assert.equal(of('kkkkmm'), 'slipping')
	})

	it('is back on track once kept after a miss among the three before', () => {
		assert.equal(of('kkkkmkk'), 'back-on-track')
		assert.equal(of('kkkkmkkkk'), 'on-track')
	})

	it('is off and on with more than one miss among the last ten', () => {
		assert.equal(of('kmkkkmkkkkk'), 'off-and-on')
		assert.equal(of('mkkkkmkkkkkk'), 'on-track')
	})
})
