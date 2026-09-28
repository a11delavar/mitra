import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { CalendarPeriod } from './CalendarPeriod.js'

describe('CalendarPeriod', () => {
	const date = new DateTime('2026-08-19T10:30:00')

	it('steps by its own length', () => {
		assert.deepEqual(CalendarPeriod.of('week').step, { weeks: 1 })
		assert.deepEqual(CalendarPeriod.of('month').step, { months: 1 })
		assert.deepEqual(CalendarPeriod.of('year').step, { years: 1 })
	})

	it('is what each view shows: the timeline steps by months, the table not at all', () => {
		assert.equal(CalendarPeriod.ofView('week'), CalendarPeriod.of('week'))
		assert.equal(CalendarPeriod.ofView('timeline'), CalendarPeriod.of('month'))
		assert.equal(CalendarPeriod.ofView('year'), CalendarPeriod.of('year'))
		assert.equal(CalendarPeriod.ofView('table'), undefined)
	})

	it('titles a week by its month, which also has a short form', () => {
		assert.equal(CalendarPeriod.of('week').title(date), CalendarPeriod.of('month').title(date))
		assert.notEqual(CalendarPeriod.of('week').title(date, 'short'), CalendarPeriod.of('week').title(date))
		assert.equal(CalendarPeriod.of('year').title(date), '2026')
	})
})
