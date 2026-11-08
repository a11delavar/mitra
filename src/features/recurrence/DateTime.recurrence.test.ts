import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { RecurrenceWeekday } from './RecurrenceWeekday.js'
import './DateTime.recurrence.js'

describe('DateTime.weekdayOfMonth and lastWeekdayOfMonth', () => {
	it('counts its weekday in its Gregorian month, the 1st of any week being the 1st', () => {
		assert.equal(String(new DateTime('2026-10-01T09:00:00').weekdayOfMonth), '1TH')
		assert.equal(String(new DateTime('2026-10-08T09:00:00').weekdayOfMonth), '2TH')
		assert.equal(String(new DateTime('2026-10-29T09:00:00').weekdayOfMonth), '5TH')
	})

	it('is the month\'s last of its weekday only where a week later is another month', () => {
		assert.equal(new DateTime('2026-10-29T09:00:00').lastWeekdayOfMonth, true)
		assert.equal(new DateTime('2026-10-24T09:00:00').lastWeekdayOfMonth, false)
	})

	it('counts in Gregorian months whatever calendar it is read in', () => {
		// Thu 1 Oct 2026 in Tehran is the 9th of Mehr 1405: the 2nd Thursday of Mehr, but the 1st of October.
		const mehr9 = DateTime.from(Date.parse('2026-10-01T09:00:00+03:30'), 'persian', 'Asia/Tehran')
		assert.equal(String(mehr9.weekdayOfMonth), '1TH')
		assert.equal(mehr9.lastWeekdayOfMonth, false)
	})
})

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
