import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { CalendarLocation } from './CalendarLocation.js'

describe('CalendarLocation', () => {
	const day = new DateTime('2027-01-05T00:00:00')
	const of = (url: string) => CalendarLocation.of(new URL(url, 'https://mitra.test'), 'week')

	describe('reading a URL', () => {
		it('takes the view from the path and the rest from the query', () => {
			const location = of('/month?date=2027-01-05&selected=entry-1&settings=notifications')
			assert.equal(location.view, 'month')
			assert.equal(location.date.dayStart.valueOf(), day.valueOf())
			assert.equal(location.selected, 'entry-1')
			assert.equal(location.settings, 'notifications')
		})

		it('falls back to the given view when the path names none or names nonsense', () => {
			assert.equal(of('/').view, 'week')
			assert.equal(of('/nonsense').view, 'week')
		})

		it('anchors at today when no day is named, or the named one is not a day', () => {
			const today = new DateTime().dayStart.valueOf()
			assert.equal(of('/week').date.dayStart.valueOf(), today)
			assert.equal(of('/week?date=whenever').date.dayStart.valueOf(), today)
			assert.equal(of('/week?date=2027-13-45').date.dayStart.valueOf(), today)
		})
	})

	describe('writing a URL', () => {
		it('round-trips everything it carries', () => {
			const parameters = new CalendarLocation('year', day, 'entry-1', 'general').parameters
			assert.deepEqual(parameters, { view: 'year', date: '2027-01-05', selected: 'entry-1', settings: 'general' })
		})

		it('leaves today out, so a shared link to "now" does not pin the day it was copied on', () => {
			assert.deepEqual(new CalendarLocation('week', new DateTime()).parameters, { view: 'week' })
		})

		it('pads a day to its calendar form', () => {
			assert.equal(new CalendarLocation('week', new DateTime('2027-09-03T00:00:00')).parameters.date, '2027-09-03')
		})

		it('writes the ISO day whatever calendar the language reads it in', () => {
			const persian = new DateTime('2027-03-15T00:00:00')
			Object.defineProperties(persian, { year: { get: () => 1405 }, month: { get: () => 12 }, day: { get: () => 24 } })
			assert.equal(new CalendarLocation('week', persian).parameters.date, '2027-03-15')
		})

		it('omits what is not open rather than writing it empty', () => {
			const parameters = new CalendarLocation('timeline', day).parameters
			assert.equal('selected' in parameters, false)
			assert.equal('settings' in parameters, false)
		})
	})

	describe('building a URL', () => {
		it('puts the view in the path and the rest in the query, inheriting nothing from the base', () => {
			const url = new CalendarLocation('month', day, 'entry-1').url('https://mitra.test/week?settings=general')
			assert.equal(url.pathname, '/month')
			assert.equal(url.searchParams.get('date'), '2027-01-05')
			assert.equal(url.searchParams.get('selected'), 'entry-1')
			assert.equal(url.searchParams.get('settings'), null)
		})
	})
})
