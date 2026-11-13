import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import './DateTime.calendar.js'

describe('DateTime.isoDate', () => {
	// Noon UTC, the same day in every zone a test machine may run in.
	const noon = Date.parse('2026-10-09T12:00:00Z')

	it('writes the ISO day', () => {
		assert.equal(DateTime.from(noon, 'gregory', 'UTC').isoDate, '2026-10-09')
	})

	it('writes the ISO day whatever calendar the date reads in', () => {
		const persian = DateTime.from(noon, 'persian', 'UTC')
		assert.equal(persian.year, 1405)
		assert.equal(persian.isoDate, '2026-10-09')
	})
})

describe('DateTime.formatAsSeenFrom', () => {
	const tuesday = DateTime.from(Date.parse('2026-10-20T09:00:00Z'), 'gregory', 'UTC')
	const date = (day: DateTime) => day.format({ day: 'numeric', month: 'short' })

	it('names the time on the same day, and nothing for a day', () => {
		const evening = tuesday.add({ hours: 8 })
		assert.equal(evening.formatAsSeenFrom(tuesday, true), evening.format({ timeStyle: 'short' }))
		assert.equal(evening.formatAsSeenFrom(tuesday, false), undefined)
	})

	it('names the weekday only within the week ahead', () => {
		const friday = tuesday.add({ days: 3 })
		const nextTuesday = tuesday.add({ days: tuesday.daysInWeek })
		const lastFriday = tuesday.subtract({ days: 4 })
		assert.equal(friday.formatAsSeenFrom(tuesday, true), friday.format({ weekday: 'short' }))
		assert.equal(nextTuesday.formatAsSeenFrom(tuesday, true), date(nextTuesday))
		assert.equal(lastFriday.formatAsSeenFrom(tuesday, true), date(lastFriday))
	})

	it('adds the year only where it differs', () => {
		const nextYear = tuesday.add({ years: 1 })
		assert.equal(nextYear.formatAsSeenFrom(tuesday, true), nextYear.format({ day: 'numeric', month: 'short', year: 'numeric' }))
	})
})
