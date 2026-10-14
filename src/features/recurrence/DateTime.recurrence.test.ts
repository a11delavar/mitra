import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { RecurrenceWeekday } from './RecurrenceWeekday.js'
import './DateTime.recurrence.js'

describe('DateTime.firstOccurrenceOn', () => {
	// Thu 25 Jun 2026, mid-morning.
	const thursday = new DateTime('2026-06-25T09:30:00')
	const day = (date: DateTime) => date.recurrenceDate.toString()

	it('occurs first today when today is one of the days, at the start of the day', () => {
		const start = thursday.firstOccurrenceOn([RecurrenceWeekday.Monday, RecurrenceWeekday.Thursday])
		assert.equal(day(start), '2026-06-25')
		assert.ok(start.equals(thursday.dayStart))
	})

	it('occurs first on the next of the days otherwise, across a week\'s end', () => {
		assert.equal(day(thursday.firstOccurrenceOn([RecurrenceWeekday.Saturday])), '2026-06-27')
		assert.equal(day(thursday.firstOccurrenceOn([RecurrenceWeekday.Tuesday, RecurrenceWeekday.Wednesday])), '2026-06-30')
	})

	it('occurs first today when no day is given', () => {
		assert.equal(day(thursday.firstOccurrenceOn([])), '2026-06-25')
	})
})
