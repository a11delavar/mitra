import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { RecurrenceEnd } from './RecurrenceEnd.js'

const day = (iso: string) => new RecurrenceEnd(Temporal.PlainDate.from(iso))

describe('RecurrenceEnd', () => {
	it('is stored as UTC midnight of its day, and read back from it', () => {
		const end = day('2026-07-18')
		assert.equal(new Date(end.instant.valueOf()).toISOString(), '2026-07-18T00:00:00.000Z')
		assert.ok(end.instant instanceof DateTime)
		assert.ok(RecurrenceEnd.of(end.instant).equals(end))
		assert.ok(RecurrenceEnd.of(new Date('2026-07-18T23:59:59Z')).equals(end))
	})

	it('writes the value type its series starts with', () => {
		assert.equal(day('2026-07-18').toRRule(true), '20260718')
		assert.equal(day('2026-07-18').toRRule(false), '20260718T235959Z')
	})

	it('reads the day an RRULE\'s UNTIL, the wire or a stored instant names', () => {
		assert.ok(RecurrenceEnd.parse('20260718')!.equals(day('2026-07-18')))
		assert.ok(RecurrenceEnd.parse('20260718T235959Z')!.equals(day('2026-07-18')))
		assert.ok(RecurrenceEnd.parse('2026-07-18')!.equals(day('2026-07-18')))
		assert.ok(RecurrenceEnd.parse('2026-07-18T00:00:00.000Z')!.equals(day('2026-07-18')))
		assert.ok(RecurrenceEnd.parse(new Date('2026-07-18T23:00:00Z'))!.equals(day('2026-07-18')))
		const end = day('2026-07-18')
		assert.equal(RecurrenceEnd.parse(end), end)
		assert.equal(RecurrenceEnd.parse('soon'), undefined)
		assert.equal(RecurrenceEnd.parse(undefined), undefined)
	})

	it('ends a series the UTC day before an occurrence', () => {
		assert.ok(RecurrenceEnd.before(new Date('2026-06-25T09:00:00Z')).equals(day('2026-06-24')))
		assert.ok(RecurrenceEnd.before(new Date('2026-03-01T00:30:00Z')).equals(day('2026-02-28')))
	})

	it('is named by month and day, in the app\'s locale by default', () => {
		assert.equal(day('2026-07-18').format('en'), 'Jul 18')
		assert.equal(day('2026-07-18').format(new Intl.Locale('en-GB')), '18 Jul')
		assert.equal(day('2026-07-18').format(), day('2026-07-18').format(Localizer.locales.current))
		assert.equal(day('2026-07-18').toString(), '2026-07-18')
	})

	it('names its own day to a reader behind UTC', () => {
		const zone = process.env.TZ
		process.env.TZ = 'Pacific/Honolulu'
		try {
			assert.equal(day('2026-07-18').format('en'), 'Jul 18')
		} finally {
			process.env.TZ = zone
		}
	})

	// The API client clones every request body, and the editor's dirty check compares deeply: a native Temporal object
	// fails the first and `PlainDate#valueOf` throws at the second, so the day must be plain data.
	it('holds its day as plain data', () => {
		const end = day('2026-07-18')
		assert.deepEqual(Object.values(structuredClone(end)), ['2026-07-18'])
		assert.deepEqual(end, day('2026-07-18'))
		assert.notDeepEqual(end, day('2026-07-19'))
	})

	it('crosses the wire as its UTC midnight, as it always did, and the database as that in milliseconds', () => {
		assert.equal(RecurrenceEnd.converter.deconstruct!(day('2026-07-18'), {}), '2026-07-18T00:00:00.000Z')
		assert.equal(RecurrenceEnd.converter.deconstruct!(undefined, {}), undefined)
		assert.ok(RecurrenceEnd.converter.construct!('2026-07-18T00:00:00.000Z', {})!.equals(day('2026-07-18')))
		assert.ok(RecurrenceEnd.converter.construct!('2026-07-18', {})!.equals(day('2026-07-18')))
	})
})
