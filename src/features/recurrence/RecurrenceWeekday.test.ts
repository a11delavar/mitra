import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RecurrenceWeekday } from './RecurrenceWeekday.js'

const codes = (weekdays: ReadonlyArray<RecurrenceWeekday>) => weekdays.map(String)

describe('RecurrenceWeekday', () => {
	it('is the RFC 5545 code of a date\'s day, Monday first', () => {
		assert.equal(RecurrenceWeekday.of(Temporal.PlainDate.from('2026-06-25')), RecurrenceWeekday.Thursday)
		assert.equal(RecurrenceWeekday.of(Temporal.PlainDate.from('2026-06-29')), RecurrenceWeekday.Monday)
		assert.equal(RecurrenceWeekday.of(Temporal.PlainDate.from('2026-06-28')), RecurrenceWeekday.Sunday)
	})

	it('reads a BYDAY part with its ordinal, the plain weekdays being one instance each', () => {
		assert.equal(RecurrenceWeekday.parse('TH'), RecurrenceWeekday.Thursday)
		assert.equal(RecurrenceWeekday.parse('th'), RecurrenceWeekday.Thursday)
		assert.equal(RecurrenceWeekday.parse(RecurrenceWeekday.Thursday), RecurrenceWeekday.Thursday)
		assert.ok(RecurrenceWeekday.parse('-1TH')!.equals(RecurrenceWeekday.Thursday.nth(-1)))
		assert.equal(RecurrenceWeekday.parse('+2TU')!.toString(), '2TU')
		assert.equal(RecurrenceWeekday.parse('XX'), undefined)
		assert.equal(RecurrenceWeekday.parse('TH '), undefined)
		assert.equal(RecurrenceWeekday.parse(4), undefined)
	})

	it('tells weekdays apart by their ordinal too', () => {
		assert.ok(RecurrenceWeekday.Monday.nth(2).equals(RecurrenceWeekday.Monday.nth(2)))
		assert.ok(!RecurrenceWeekday.Monday.nth(2).equals(RecurrenceWeekday.Monday.nth(-1)))
		assert.ok(!RecurrenceWeekday.Monday.nth(2).equals(RecurrenceWeekday.Monday))
		assert.ok(!RecurrenceWeekday.Monday.equals(RecurrenceWeekday.Tuesday))
		assert.ok(!RecurrenceWeekday.Monday.equals(undefined))
	})

	it('moves by days, across the week both ways, keeping its ordinal', () => {
		assert.equal(RecurrenceWeekday.Sunday.plus(1), RecurrenceWeekday.Monday)
		assert.equal(RecurrenceWeekday.Sunday.plus(-7), RecurrenceWeekday.Sunday)
		assert.equal(RecurrenceWeekday.Monday.plus(-1), RecurrenceWeekday.Sunday)
		assert.equal(RecurrenceWeekday.Wednesday.plus(16), RecurrenceWeekday.Friday)
		assert.equal(RecurrenceWeekday.Thursday.nth(-1).plus(1).toString(), '-1FR')
	})

	it('is named in a language, whatever zone the reader is in', () => {
		const zone = process.env.TZ
		process.env.TZ = 'Pacific/Honolulu'
		try {
			assert.equal(RecurrenceWeekday.Thursday.format('en'), 'Thu')
		} finally {
			process.env.TZ = zone
		}
		assert.equal(RecurrenceWeekday.Monday.format(new Intl.Locale('de')), new Intl.DateTimeFormat('de', { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1)))
	})

	// The Localizer reads the browser's preferences; under Node it must fall back rather than throw, since the shared
	// domain formats with it in tests and on the server.
	it('is named in the app\'s locale by default, under Node too', () => {
		assert.ok(Localizer.locales.current instanceof Intl.Locale)
		assert.equal(RecurrenceWeekday.Thursday.format(), RecurrenceWeekday.Thursday.format(Localizer.locales.current))
	})

	it('runs the week and its workdays as the locale does', () => {
		assert.deepEqual(codes(RecurrenceWeekday.week(new Intl.Locale('de'))), ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])
		assert.deepEqual(codes(RecurrenceWeekday.week(new Intl.Locale('en-US'))), ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])
		assert.deepEqual(codes(RecurrenceWeekday.workdays(new Intl.Locale('de'))), ['MO', 'TU', 'WE', 'TH', 'FR'])
		assert.deepEqual(codes(RecurrenceWeekday.workdays(new Intl.Locale('en-US'))), ['MO', 'TU', 'WE', 'TH', 'FR'])
		assert.deepEqual(codes(RecurrenceWeekday.workdays(new Intl.Locale('fa-IR'))), ['SA', 'SU', 'MO', 'TU', 'WE', 'TH'])
		assert.deepEqual(codes(RecurrenceWeekday.workdays(new Intl.Locale('he-IL'))), ['SU', 'MO', 'TU', 'WE', 'TH'])
	})

	it('crosses the wire and the database as its BYDAY parts', () => {
		const weekdays = [RecurrenceWeekday.Monday, RecurrenceWeekday.Friday.nth(-1)]
		assert.deepEqual(RecurrenceWeekday.converter.deconstruct!(weekdays, {}), ['MO', '-1FR'])
		assert.deepEqual(RecurrenceWeekday.converter.construct!(['MO', '-1FR'], {}), weekdays)
		assert.equal(RecurrenceWeekday.converter.deconstruct!(undefined, {}), undefined)
	})
})
