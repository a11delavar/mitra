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
		it('is true when start and end sit at midnight', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }) }).allDay, true)
		})

		it('is false when there is a time of day', () => {
			assert.equal(new Entry({ start: day.add({ hours: 9 }), end: day.add({ hours: 10 }) }).allDay, false)
		})
	})
})
