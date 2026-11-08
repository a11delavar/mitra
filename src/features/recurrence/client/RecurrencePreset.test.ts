import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Localizer } from '@3mo/localization'
import en from '#infrastructure/i18n/en.json' with { type: 'json' }
import { Recurrence } from '../Recurrence.js'
import { RecurrencePreset } from './RecurrencePreset.js'

Localizer.dictionaries.add({ en })

describe('RecurrencePreset', () => {
	// Thu 25 Jun 2026: the last Thursday of June, and its 4th.
	const thu = new DateTime('2026-06-25T09:00:00')

	describe('of', () => {
		it('derives the quick presets from the start date', () => {
			const byId = new Map(RecurrencePreset.of(thu).map(p => [p.id, p]))
			assert.equal(byId.get('weekly')?.recurrence?.toRRule(), 'FREQ=WEEKLY;BYDAY=TH')
			assert.equal(byId.get('weekly')?.detail, 'on Thu')
			assert.equal(byId.get('biweekly')?.recurrence?.toRRule(), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TH')
			assert.equal(byId.get('monthly-day')?.recurrence?.toRRule(), 'FREQ=MONTHLY;BYMONTHDAY=25')
			assert.equal(byId.get('monthly-weekday')?.recurrence?.toRRule(), 'FREQ=MONTHLY;BYDAY=4TH')
			assert.equal(byId.get('monthly-weekday')?.detail, 'on the 4th Thu')
			// Jun 25 2026 is the last Thursday, so "the last Thu" is also offered.
			assert.equal(byId.get('monthly-last')?.recurrence?.toRRule(), 'FREQ=MONTHLY;BYDAY=-1TH')
			assert.equal(byId.get('none')?.recurrence, undefined)
		})

		// RFC 5545 counts BYMONTHDAY and the nth weekday in Gregorian months, whichever calendar the language shows.
		it('counts month days in ISO under a Persian display calendar', () => {
			// Thu 1 Oct 2026 in Tehran is the 9th of Mehr 1405, the 2nd Thursday of Mehr but the 1st of October.
			const mehr9 = DateTime.from(Date.parse('2026-10-01T09:00:00+03:30'), 'persian', 'Asia/Tehran')
			assert.equal(mehr9.day, 9)
			assert.equal(mehr9.recurrenceDate.toString(), '2026-10-01')
			const byId = new Map(RecurrencePreset.of(mehr9).map(p => [p.id, p]))
			assert.equal(byId.get('monthly-day')?.recurrence?.toRRule(), 'FREQ=MONTHLY;BYMONTHDAY=1')
			assert.equal(byId.get('monthly-weekday')?.recurrence?.toRRule(), 'FREQ=MONTHLY;BYDAY=1TH')
			assert.equal(byId.get('yearly')?.detail, 'on Oct 1')
			// Thu 29 Oct 2026, the last Thursday of October, is the 7th of Aban, nowhere near the end of a Persian month.
			const aban7 = DateTime.from(Date.parse('2026-10-29T09:00:00+03:30'), 'persian', 'Asia/Tehran')
			assert.ok(RecurrencePreset.of(aban7).some(p => p.id === 'monthly-last'))
		})

		it('omits the "last weekday" preset when the date is not the last such weekday', () => {
			// Thu 11 Jun 2026 is the 2nd Thursday, not the last.
			const ids = RecurrencePreset.of(new DateTime('2026-06-11T09:00:00')).map(p => p.id)
			assert.ok(!ids.includes('monthly-last'))
			assert.ok(ids.includes('monthly-weekday'))
		})
	})

	describe('chosenIn', () => {
		const presets = RecurrencePreset.of(thu)

		it('matches a preset regardless of part order', () => {
			assert.equal(RecurrencePreset.chosenIn(presets, Recurrence.fromRRule('BYDAY=TH;FREQ=WEEKLY')), 'weekly')
			assert.equal(RecurrencePreset.chosenIn(presets, undefined), 'none')
		})

		it('treats a bounded variant of a preset as custom (no preset match)', () => {
			assert.equal(RecurrencePreset.chosenIn(presets, Recurrence.fromRRule('FREQ=WEEKLY;BYDAY=TH;UNTIL=20260718T235959Z')), undefined)
		})
	})
})
