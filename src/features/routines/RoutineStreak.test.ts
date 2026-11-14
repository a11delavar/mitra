import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RoutineStreak } from './RoutineStreak.js'

describe('RoutineStreak', () => {
	/** The streaks along dates written as k (kept) and m (missed), each as its kept dates' positions. */
	const along = (dates: string) => RoutineStreak.along([...dates].map((date, index) => ({ index, kept: date === 'k' })), date => date.kept)
		.map(streak => streak.dates.map(date => date.index))

	it('counts the dates kept in a row up to the last', () => {
		const [streak] = RoutineStreak.along(['a', 'b', 'c'], () => true)
		assert.deepEqual([streak!.length, streak!.since, streak!.out], [3, 'a', false])
	})

	it('ends at a miss, and starts again at the next kept date', () => {
		assert.deepEqual(along('kkmkk'), [[0, 1], [3, 4]])
	})

	it('is out after a missed last date, however many were missed', () => {
		assert.deepEqual(along('kkm'), [[0, 1], []])
		assert.deepEqual(along('kkmmm'), [[0, 1], []])
		assert.equal(RoutineStreak.along([false], kept => kept).at(-1)!.out, true)
	})

	it('has none before a date settled', () => {
		assert.deepEqual(RoutineStreak.along([], () => true), [])
	})
})
