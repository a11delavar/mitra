import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Localizer } from '@3mo/localization'
import en from '#infrastructure/i18n/en.json' with { type: 'json' }
import { RecurrenceFrequency } from './RecurrenceFrequency.js'

// The plural phrases live in the English dictionary, not in their keys.
Localizer.dictionaries.add({ en })

describe('RecurrenceFrequency', () => {
	it('reads the code a rule, a column or a request names, in any case', () => {
		assert.equal(RecurrenceFrequency.parse('WEEKLY'), RecurrenceFrequency.Weekly)
		assert.equal(RecurrenceFrequency.parse('monthly'), RecurrenceFrequency.Monthly)
		assert.equal(RecurrenceFrequency.parse(RecurrenceFrequency.Yearly), RecurrenceFrequency.Yearly)
		assert.equal(RecurrenceFrequency.parse('HOURLY'), undefined)
		assert.equal(RecurrenceFrequency.parse(7), undefined)
		assert.equal(RecurrenceFrequency.parse(undefined), undefined)
		assert.deepEqual(RecurrenceFrequency.all.map(String), ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
	})

	it('lasts its unit\'s mean days', () => {
		assert.deepEqual(RecurrenceFrequency.all.map(frequency => frequency.days), [1, 7, 30.436875, 365.2425])
	})

	it('reads "Every …", its singular being the interval-less phrase', () => {
		assert.equal(RecurrenceFrequency.Daily.format(), 'Every day')
		assert.equal(RecurrenceFrequency.Weekly.format(2), 'Every 2 weeks')
		assert.equal(RecurrenceFrequency.Monthly.format(3), 'Every 3 months')
		assert.equal(RecurrenceFrequency.Yearly.format(), 'Every year')
	})

	it('names its unit as the number beside it asks for it', () => {
		assert.equal(RecurrenceFrequency.Weekly.formatUnit(1, 'en'), 'week')
		assert.equal(RecurrenceFrequency.Weekly.formatUnit(2, 'en'), 'weeks')
		assert.equal(RecurrenceFrequency.Daily.formatUnit(2, new Intl.Locale('de')), 'Tage')
		assert.equal(RecurrenceFrequency.Yearly.formatUnit(2), RecurrenceFrequency.Yearly.formatUnit(2, Localizer.locales.current))
	})
})
