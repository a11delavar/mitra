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
