import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Localizer } from '@3mo/localization'
import en from '#infrastructure/i18n/en.json' with { type: 'json' }
import type { ValidationError } from '#infrastructure/validation'
import { Recurrence } from './Recurrence.js'
import { RecurrenceEnd } from './RecurrenceEnd.js'
import { RecurrenceFrequency } from './RecurrenceFrequency.js'
import { RecurrenceWeekday } from './RecurrenceWeekday.js'

// The plural phrases ("Every day" / "Every 2 weeks") live in the English dictionary, not in their keys.
Localizer.dictionaries.add({ en })

describe('Recurrence', () => {
	// Thu 25 Jun 2026: the last Thursday of June, and its 4th.
	const thu = new DateTime('2026-06-25T09:00:00')
	const untilDay = (iso: string) => new RecurrenceEnd(Temporal.PlainDate.from(iso))

	describe('ordinal', () => {
		it('formats English ordinals', () => {
			assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 25].map(Recurrence.ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '25th'])
		})
	})

	describe('interval / every', () => {
		// A default would become a column default and give every row a rule.
		it('treats a missing interval as every-1 and omits it from the rule', () => {
			const r = new Recurrence({ freq: RecurrenceFrequency.Daily })
			assert.equal(r.interval, undefined)
			assert.equal(r.every, 1)
			assert.equal(r.toRRule(), 'FREQ=DAILY')
		})

		it('honours an interval > 1', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 3 }).every, 3)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 3, byday: [RecurrenceWeekday.Thursday] }).toRRule(), 'FREQ=WEEKLY;INTERVAL=3;BYDAY=TH')
		})

		it('matches a 1-interval rule with an unset-interval rule', () => {
			assert.ok(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Thursday], interval: 1 }).equals(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Thursday] })))
		})
	})

	describe('toRRule', () => {
		it('emits a bare weekly rule', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Thursday] }).toRRule(), 'FREQ=WEEKLY;BYDAY=TH')
		})

		it('includes interval, multiple weekdays and a COUNT end', () => {
			assert.equal(
				new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 2, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Wednesday, RecurrenceWeekday.Friday], count: 5 }).toRRule(),
				'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=5',
			)
		})

		it('emits BYMONTHDAY for a monthly rule', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: 25 }).toRRule(), 'FREQ=MONTHLY;BYMONTHDAY=25')
		})

		it('emits a monthly ordinal weekday', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Thursday.nth(-1)] }).toRRule(), 'FREQ=MONTHLY;BYDAY=-1TH')
		})

		it('formats UNTIL as end-of-day UTC for timed, date-only for all-day', () => {
			const recurrence = new Recurrence({ freq: RecurrenceFrequency.Daily, until: untilDay('2026-07-18') })
			assert.match(recurrence.toRRule(), /UNTIL=20260718T235959Z$/)
			assert.match(recurrence.toRRule(true), /UNTIL=20260718$/)
		})

		it('prefers COUNT over UNTIL when both are set', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 3, until: untilDay('2026-07-18') }).toRRule(), 'FREQ=DAILY;COUNT=3')
		})
	})

	describe('fromRRule', () => {
		it('round-trips a built rule through toRRule', () => {
			const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=4'
			assert.equal(Recurrence.fromRRule(rule)!.toRRule(), rule)
		})

		it('parses fields', () => {
			const r = Recurrence.fromRRule('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15')!
			assert.equal(r.freq, RecurrenceFrequency.Monthly)
			assert.equal(r.interval, 2)
			assert.equal(r.bymonthday, 15)
		})

		it('tolerates a leading RRULE: prefix and arbitrary part order', () => {
			const r = Recurrence.fromRRule('RRULE:BYDAY=TH;FREQ=WEEKLY;INTERVAL=3')!
			assert.equal(r.freq, RecurrenceFrequency.Weekly)
			assert.equal(r.interval, 3)
			assert.deepEqual(r.byday?.map(String), ['TH'])
		})

		it('parses an UNTIL into the right calendar day (re-emitted stably)', () => {
			const r = Recurrence.fromRRule('FREQ=DAILY;UNTIL=20260718T235959Z')!
			assert.ok(r.until)
			assert.match(r.toRRule(), /UNTIL=20260718T235959Z$/)
		})

		it('returns undefined for empty / unmodelled rules', () => {
			assert.equal(Recurrence.fromRRule(undefined), undefined)
			assert.equal(Recurrence.fromRRule(''), undefined)
			assert.equal(Recurrence.fromRRule('FREQ=HOURLY'), undefined)
			assert.equal(Recurrence.fromRRule('NONSENSE'), undefined)
			assert.equal(Recurrence.fromRRule('FREQ=WEEKLY;BYDAY=MO,XX'), undefined)
		})
	})

	describe('converter', () => {
		it('crosses the wire as its RRULE both ways, as the database keeps it', () => {
			const rule = new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 2, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Friday.nth(-1)], until: untilDay('2026-07-18') })
			const written = Recurrence.converter.deconstruct!(rule, {})
			assert.equal(written, 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,-1FR;UNTIL=20260718T235959Z')
			assert.ok(Recurrence.converter.construct!(written, {})!.equals(rule))
			assert.equal(Recurrence.converter.deconstruct!(null, {}), null)
		})

		it('refuses a rule it cannot repeat by, naming the field', () => {
			assert.throws(() => Recurrence.converter.construct!('FREQ=HOURLY', {}), (error: ValidationError) => error.fields.includes('recurrence'))
		})
	})

	describe('with (immutable edit)', () => {
		it('returns a new instance with the patch applied, leaving the original untouched', () => {
			const base = new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Thursday] })
			const next = base.with({ interval: 2, count: 5 })
			assert.notEqual(next, base)
			assert.equal(base.every, 1)
			assert.equal(base.count, undefined)
			assert.equal(next.interval, 2)
			assert.equal(next.count, 5)
			assert.deepEqual(next.byday?.map(String), ['TH'])
		})

		it('can clear a field', () => {
			const base = new Recurrence({ freq: RecurrenceFrequency.Daily, count: 3 })
			assert.equal(base.with({ count: undefined }).count, undefined)
		})
	})

	describe('equals', () => {
		it('is order-insensitive over byday', () => {
			assert.ok(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Wednesday] }).equals(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Wednesday, RecurrenceWeekday.Monday] })))
		})

		it('compares interval, bymonthday, count and until-by-day', () => {
			assert.ok(!new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday] }).equals(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Tuesday] })))
			assert.ok(!new Recurrence({ freq: RecurrenceFrequency.Daily, count: 3 }).equals(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 4 })))
			assert.ok(new Recurrence({ freq: RecurrenceFrequency.Daily, until: untilDay('2026-07-18') }).equals(new Recurrence({ freq: RecurrenceFrequency.Daily, until: untilDay('2026-07-18') })))
			assert.ok(!new Recurrence({ freq: RecurrenceFrequency.Daily, until: untilDay('2026-07-18') }).equals(new Recurrence({ freq: RecurrenceFrequency.Daily, until: untilDay('2026-07-19') })))
		})

		it('is false against undefined', () => {
			assert.ok(!new Recurrence({ freq: RecurrenceFrequency.Daily }).equals(undefined))
		})
	})

	describe('strideDays', () => {
		it('is the frequency unit times the interval', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily }).strideDays, 1)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, interval: 2 }).strideDays, 2)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly }).strideDays, 7)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 2 }).strideDays, 14)
			assert.equal(Math.round(new Recurrence({ freq: RecurrenceFrequency.Monthly }).strideDays), 30)
			assert.equal(Math.round(new Recurrence({ freq: RecurrenceFrequency.Yearly }).strideDays), 365)
		})

		it('divides the weekly stride by the BYDAY list', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday] }).strideDays, 7)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Wednesday] }).strideDays, 3.5)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Tuesday, RecurrenceWeekday.Wednesday, RecurrenceWeekday.Thursday, RecurrenceWeekday.Friday] }).strideDays, 1.4)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Wednesday], interval: 2 }).strideDays, 7)
		})

		it('does not divide a MONTHLY stride by its BYDAY ("the 2nd Tuesday" is still monthly)', () => {
			assert.equal(Math.round(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Tuesday.nth(2)] }).strideDays), 30)
		})

		it('is Infinity for a rule with no modelled frequency', () => {
			assert.equal(new Recurrence().strideDays, Infinity)
		})
	})

	describe('valid', () => {
		it('accepts well-formed rules', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Wednesday] }).valid, true)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Thursday.nth(-1)], interval: 2 }).valid, true)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: 31, count: 5 }).valid, true)
		})

		it('treats database-hydrated nulls as absent parts, not as malformed ones', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday], interval: null as never, bymonthday: null as never, count: null as never }).valid, true)
		})

		it('rejects malformed parts: the routes 400 on these before any .ics writer sees them', () => {
			assert.equal(new Recurrence({ freq: 'BOGUS' as never }).valid, false)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.parse('XX')!] }).valid, false)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: 32 }).valid, false)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 0 }).valid, false)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, interval: 1.5 }).valid, false)
		})
	})

	describe('equal (absence-safe)', () => {
		it('treats two missing rules as the same rule, and a missing one as different from any rule', () => {
			assert.equal(Recurrence.equal(undefined, null), true)
			assert.equal(Recurrence.equal(null, new Recurrence({ freq: RecurrenceFrequency.Daily })), false)
			assert.equal(Recurrence.equal(new Recurrence({ freq: RecurrenceFrequency.Daily }), undefined), false)
			assert.equal(Recurrence.equal(new Recurrence({ freq: RecurrenceFrequency.Daily }), new Recurrence({ freq: RecurrenceFrequency.Daily })), true)
		})
	})

	describe('rebased', () => {
		const monday = Temporal.PlainDate.from('2026-06-08')
		const tuesday = Temporal.PlainDate.from('2026-06-09')

		it('is identity for a move within the day', () => {
			const rule = new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday] })
			assert.equal(rule.rebased(monday, monday), rule)
		})

		it('rotates a weekday list with the day shift', () => {
			const rule = new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Wednesday] })
			assert.deepEqual(rule.rebased(monday, tuesday).byday?.map(String), ['TU', 'TH'])
			assert.deepEqual(rule.rebased(monday, tuesday).rebased(tuesday, monday).byday?.map(String), ['MO', 'WE']) // round-trips
			assert.deepEqual(rule.rebased(monday, Temporal.PlainDate.from('2026-06-06')).byday?.map(String), ['SA', 'MO']) // -2 days wraps
		})

		it('keeps ordinal prefixes while rotating (the 2nd Tue becomes the 2nd Wed)', () => {
			assert.deepEqual(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Tuesday.nth(2)] }).rebased(tuesday, Temporal.PlainDate.from('2026-06-10')).byday?.map(String), ['2WE'])
			assert.deepEqual(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Thursday.nth(-1)] }).rebased(monday, tuesday).byday?.map(String), ['-1FR'])
		})

		it('a month-day follows the new anchor', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: 8 }).rebased(monday, tuesday).bymonthday, 9)
		})

		it('leaves day-agnostic rules alone', () => {
			const daily = new Recurrence({ freq: RecurrenceFrequency.Daily, interval: 2 })
			assert.equal(daily.rebased(monday, tuesday).equals(daily), true)
		})
	})

	describe('describe', () => {
		it('describes the common rules', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily }).describe(), 'Every day')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Tuesday, RecurrenceWeekday.Wednesday, RecurrenceWeekday.Thursday, RecurrenceWeekday.Friday] }).describe(), 'Every weekday')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Thursday] }).describe(), 'Every week on Thu')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 2, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Wednesday] }).describe(), 'Every 2 weeks on Mon and Wed')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: 25 }).describe(), 'Every month on the 25th')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Thursday.nth(-1)] }).describe(), 'Every month on the last Thu')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Thursday.nth(4)] }).describe(), 'Every month on the 4th Thu')
			// Without an ordinal, every Thursday of the month (RFC 5545 BYDAY).
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, byday: [RecurrenceWeekday.Thursday] }).describe(), 'Every month on Thu')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Yearly }).describe(thu), 'Every year on Jun 25')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Monthly, interval: 3 }).describe(), 'Every 3 months')
		})

		it('keeps an interval on a weekday rule', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, interval: 2, byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Tuesday, RecurrenceWeekday.Wednesday, RecurrenceWeekday.Thursday, RecurrenceWeekday.Friday] }).describe(), 'Every 2 weeks on Mon, Tue, Wed, Thu, and Fri')
		})

		it('appends the end clause', () => {
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Thursday], until: untilDay('2026-07-18') }).describe(), 'Every week on Thu until Jul 18')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 10 }).describe(), 'Every day, 10 times')
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 1 }).describe(), 'Every day, once')
		})
	})

	describe('presets', () => {
		it('derives the quick presets from the start date', () => {
			const byId = new Map(Recurrence.presets(thu).map(p => [p.id, p]))
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
			const byId = new Map(Recurrence.presets(mehr9).map(p => [p.id, p]))
			assert.equal(byId.get('monthly-day')?.recurrence?.toRRule(), 'FREQ=MONTHLY;BYMONTHDAY=1')
			assert.equal(byId.get('monthly-weekday')?.recurrence?.toRRule(), 'FREQ=MONTHLY;BYDAY=1TH')
			assert.equal(byId.get('yearly')?.detail, 'on Oct 1')
			// Thu 29 Oct 2026, the last Thursday of October, is the 7th of Aban, nowhere near the end of a Persian month.
			const aban7 = DateTime.from(Date.parse('2026-10-29T09:00:00+03:30'), 'persian', 'Asia/Tehran')
			assert.ok(Recurrence.presets(aban7).some(p => p.id === 'monthly-last'))
		})

		it('omits the "last weekday" preset when the date is not the last such weekday', () => {
			// Thu 11 Jun 2026 is the 2nd Thursday, not the last.
			const ids = Recurrence.presets(new DateTime('2026-06-11T09:00:00')).map(p => p.id)
			assert.ok(!ids.includes('monthly-last'))
			assert.ok(ids.includes('monthly-weekday'))
		})
	})

	describe('matchedPresetId', () => {
		const presets = Recurrence.presets(thu)

		it('matches a preset regardless of part order', () => {
			assert.equal(Recurrence.matchedPresetId(presets, Recurrence.fromRRule('BYDAY=TH;FREQ=WEEKLY')), 'weekly')
			assert.equal(Recurrence.matchedPresetId(presets, undefined), 'none')
		})

		it('treats a bounded variant of a preset as custom (no preset match)', () => {
			assert.equal(Recurrence.matchedPresetId(presets, Recurrence.fromRRule('FREQ=WEEKLY;BYDAY=TH;UNTIL=20260718T235959Z')), undefined)
		})
	})

	describe('defaultFor', () => {
		it('is weekly on the start weekday', () => {
			assert.equal(Recurrence.defaultFor(thu).toRRule(), 'FREQ=WEEKLY;BYDAY=TH')
		})
	})

	describe('split helpers (this-and-following)', () => {
		const at = (iso: string) => new Date(iso)

		it('endingBefore truncates to the day before the occurrence and clears COUNT', () => {
			const cut = new Recurrence({ freq: RecurrenceFrequency.Daily, count: 10 }).endingBefore(at('2026-06-08T09:00:00Z'))
			assert.equal(cut.count, undefined)
			assert.match(cut.toRRule(), /UNTIL=20260607T235959Z$/)
		})

		it('endingBefore ends the series on the UTC day before the instant', () => {
			assert.match(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Thursday] }).endingBefore(at('2026-06-25T09:00:00Z')).toRRule(), /UNTIL=20260624T235959Z$/)
		})

		it('asContinuation keeps UNTIL and carries the REMAINING count', () => {
			const until = untilDay('2026-12-31')
			assert.match(new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday], until }).asContinuation().toRRule(), /UNTIL=20261231T235959Z$/)
			// A "10 times" series split after its first occurrence continues "9 times", never forever.
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 10 }).asContinuation(1).count, 9)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 10 }).asContinuation(9).count, 1)
			// An unbounded rule stays unbounded, and a count never collapses below one occurrence.
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily }).asContinuation(3).count, undefined)
			assert.equal(new Recurrence({ freq: RecurrenceFrequency.Daily, count: 2 }).asContinuation(5).count, 1)
		})
	})
})
