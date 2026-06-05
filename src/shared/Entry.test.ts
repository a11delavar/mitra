import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from './Entry.js'

describe('Entry', () => {
	const day = new DateTime().dayStart

	describe('multiDay', () => {
		it('is false within a single day', () => {
			assert.equal(new Entry({ start: day.add({ hours: 9 }), end: day.add({ hours: 17 }) }).multiDay, false)
		})

		it('is true across day boundaries', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 2 }) }).multiDay, true)
		})

		it('is false when undated', () => {
			assert.equal(new Entry({}).multiDay, false)
		})
	})

	describe('allDay', () => {
		it('is a stored flag, not inferred from the times', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }), allDay: true }).allDay, true)
			// Midnight bounds alone no longer imply all-day — the flag is explicit.
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }) }).allDay, false)
		})

		it('defaults to false', () => {
			assert.equal(new Entry({ start: day.add({ hours: 9 }), end: day.add({ hours: 10 }) }).allDay, false)
			assert.equal(new Entry({}).allDay, false)
		})
	})
})
