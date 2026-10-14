import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TimeSpan } from '@3mo/date-time'
import { localizeIn } from '../../infrastructure/i18n/dictionaries.js'
import './TimeSpan.time.js'

describe('TimeSpan.formatAsWholeUnit', () => {
	const span = (minutes: number, locale = 'en') => TimeSpan.fromMinutes(minutes).formatAsWholeUnit(localizeIn(locale))

	it('names a span in the largest unit it fills whole', () => {
		assert.equal(span(30), '30 min')
		assert.equal(span(60), '1 hour')
		assert.equal(span(90), '90 min')
		assert.equal(span(120), '2 hours')
		assert.equal(span(1440), '1 day')
		assert.equal(span(2880), '2 days')
		assert.equal(span(10080), '1 week')
		assert.equal(span(20160), '2 weeks')
	})

	it('speaks the reader\'s language', () => {
		assert.equal(span(2880, 'de'), '2 Tage')
	})
})
