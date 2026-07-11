import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Recurrence } from './Recurrence.js'

describe('Recurrence', () => {
	// Thu 25 Jun 2026 — the screenshots' anchor (the last Thursday of June, 4th week).
	const thu = new DateTime('2026-06-25T09:00:00')

	describe('weekdayCode / weekdayLabel / ordinal', () => {
		it('maps a date to its RRULE weekday code', () => {
			assert.equal(Recurrence.weekdayCode(thu), 'TH')
			assert.equal(Recurrence.weekdayCode(new DateTime('2026-06-29T00:00:00')), 'MO')
		})

		it('labels weekday codes, ignoring a leading ordinal', () => {
			assert.equal(Recurrence.weekdayLabel('TH'), 'Thu')
			assert.equal(Recurrence.weekdayLabel('-1TH'), 'Thu')
			assert.equal(Recurrence.weekdayLabel('2TU'), 'Tue')
		})

		it('formats English ordinals', () => {
			assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 25].map(Recurrence.ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '25th'])
		})
	})

	describe('interval / every', () => {
		// No constructor/field default (that would become a column DEFAULT and break the freq-IS-NULL query):
		// interval is read as `every` (1 when unset) and 1 is never serialised.
		it('treats a missing interval as every-1 and omits it from the rule', () => {
			const r = new Recurrence({ freq: 'DAILY' })
			assert.equal(r.interval, undefined)
			assert.equal(r.every, 1)
			assert.equal(r.toRRule(), 'FREQ=DAILY')
		})

		it('honours an interval > 1', () => {
			assert.equal(new Recurrence({ freq: 'WEEKLY', interval: 3 }).every, 3)
			assert.equal(new Recurrence({ freq: 'WEEKLY', interval: 3, byday: ['TH'] }).toRRule(), 'FREQ=WEEKLY;INTERVAL=3;BYDAY=TH')
		})

		it('matches a 1-interval rule with an unset-interval rule', () => {
			assert.ok(new Recurrence({ freq: 'WEEKLY', byday: ['TH'], interval: 1 }).equals(new Recurrence({ freq: 'WEEKLY', byday: ['TH'] })))
		})
	})

	describe('toRRule', () => {
		it('emits a bare weekly rule', () => {
			assert.equal(new Recurrence({ freq: 'WEEKLY', byday: ['TH'] }).toRRule(), 'FREQ=WEEKLY;BYDAY=TH')
		})

		it('includes interval, multiple weekdays and a COUNT end', () => {
			assert.equal(
				new Recurrence({ freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE', 'FR'], count: 5 }).toRRule(),
				'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=5'
			)
		})

		it('emits BYMONTHDAY for a monthly rule', () => {
			assert.equal(new Recurrence({ freq: 'MONTHLY', bymonthday: 25 }).toRRule(), 'FREQ=MONTHLY;BYMONTHDAY=25')
		})

		it('emits a monthly ordinal weekday', () => {
			assert.equal(new Recurrence({ freq: 'MONTHLY', byday: ['-1TH'] }).toRRule(), 'FREQ=MONTHLY;BYDAY=-1TH')
		})

		it('formats UNTIL as end-of-day UTC for timed, date-only for all-day', () => {
			const recurrence = new Recurrence({ freq: 'DAILY', until: Recurrence.untilFromDay(2026, 7, 18) })
			assert.match(recurrence.toRRule(), /UNTIL=20260718T235959Z$/)
			assert.match(recurrence.toRRule(true), /UNTIL=20260718$/)
		})

		it('prefers COUNT over UNTIL when both are set', () => {
			assert.equal(new Recurrence({ freq: 'DAILY', count: 3, until: thu }).toRRule(), 'FREQ=DAILY;COUNT=3')
		})
	})

	describe('fromRRule', () => {
		it('round-trips a built rule through toRRule', () => {
			const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=4'
			assert.equal(Recurrence.fromRRule(rule)!.toRRule(), rule)
		})

		it('parses fields', () => {
			const r = Recurrence.fromRRule('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15')!
			assert.equal(r.freq, 'MONTHLY')
			assert.equal(r.interval, 2)
			assert.equal(r.bymonthday, 15)
		})

		it('tolerates a leading RRULE: prefix and arbitrary part order', () => {
			const r = Recurrence.fromRRule('RRULE:BYDAY=TH;FREQ=WEEKLY;INTERVAL=3')!
			assert.equal(r.freq, 'WEEKLY')
			assert.equal(r.interval, 3)
			assert.deepEqual(r.byday, ['TH'])
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
		})
	})

	describe('from (plain object across the wire)', () => {
		it('reconstructs and normalises an ISO until to a DateTime', () => {
			const r = Recurrence.from({ freq: 'WEEKLY', interval: 2, byday: ['MO'], until: '2026-07-18T00:00:00.000Z' as unknown as DateTime })!
			assert.ok(r instanceof Recurrence)
			assert.equal(r.interval, 2)
			assert.ok(r.until instanceof DateTime)
			assert.match(r.toRRule(), /^FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;UNTIL=2026/)
		})

		it('returns undefined for null / undefined / freq-less input', () => {
			assert.equal(Recurrence.from(undefined), undefined)
			assert.equal(Recurrence.from(null), undefined)
			assert.equal(Recurrence.from({ interval: 2 }), undefined)
		})
	})

	describe('with (immutable edit)', () => {
		it('returns a new instance with the patch applied, leaving the original untouched', () => {
			const base = new Recurrence({ freq: 'WEEKLY', byday: ['TH'] })
			const next = base.with({ interval: 2, count: 5 })
			assert.notEqual(next, base)
			assert.equal(base.every, 1)
			assert.equal(base.count, undefined)
			assert.equal(next.interval, 2)
			assert.equal(next.count, 5)
			assert.deepEqual(next.byday, ['TH'])
		})

		it('can clear a field', () => {
			const base = new Recurrence({ freq: 'DAILY', count: 3 })
			assert.equal(base.with({ count: undefined }).count, undefined)
		})
	})

	describe('equals', () => {
		it('is order-insensitive over byday', () => {
			assert.ok(new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'WE'] }).equals(new Recurrence({ freq: 'WEEKLY', byday: ['WE', 'MO'] })))
		})

		it('compares interval, bymonthday, count and until-by-day', () => {
			assert.ok(!new Recurrence({ freq: 'WEEKLY', byday: ['MO'] }).equals(new Recurrence({ freq: 'WEEKLY', byday: ['TU'] })))
			assert.ok(!new Recurrence({ freq: 'DAILY', count: 3 }).equals(new Recurrence({ freq: 'DAILY', count: 4 })))
			assert.ok(new Recurrence({ freq: 'DAILY', until: Recurrence.untilFromDay(2026, 7, 18) }).equals(new Recurrence({ freq: 'DAILY', until: Recurrence.untilFromDay(2026, 7, 18) })))
			assert.ok(!new Recurrence({ freq: 'DAILY', until: Recurrence.untilFromDay(2026, 7, 18) }).equals(new Recurrence({ freq: 'DAILY', until: Recurrence.untilFromDay(2026, 7, 19) })))
		})

		it('is false against undefined', () => {
			assert.ok(!new Recurrence({ freq: 'DAILY' }).equals(undefined))
		})
	})

	describe('valid', () => {
		it('accepts well-formed rules', () => {
			assert.equal(new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'WE'] }).valid, true)
			assert.equal(new Recurrence({ freq: 'MONTHLY', byday: ['-1TH'], interval: 2 }).valid, true)
			assert.equal(new Recurrence({ freq: 'MONTHLY', bymonthday: 31, count: 5 }).valid, true)
		})

		it('treats database-hydrated nulls as absent parts, not as malformed ones', () => {
			assert.equal(new Recurrence({ freq: 'WEEKLY', byday: ['MO'], interval: null as never, bymonthday: null as never, count: null as never }).valid, true)
		})

		it('rejects malformed parts — the routes 400 on these before any .ics writer sees them', () => {
			assert.equal(new Recurrence({ freq: 'BOGUS' as never }).valid, false)
			assert.equal(new Recurrence({ freq: 'WEEKLY', byday: ['XX'] }).valid, false)
			assert.equal(new Recurrence({ freq: 'MONTHLY', bymonthday: 32 }).valid, false)
			assert.equal(new Recurrence({ freq: 'DAILY', count: 0 }).valid, false)
			assert.equal(new Recurrence({ freq: 'DAILY', interval: 1.5 }).valid, false)
		})
	})

	describe('equal (absence-safe)', () => {
		it('treats two missing rules as the same rule, and a missing one as different from any rule', () => {
			assert.equal(Recurrence.equal(undefined, null), true)
			assert.equal(Recurrence.equal(null, new Recurrence({ freq: 'DAILY' })), false)
			assert.equal(Recurrence.equal(new Recurrence({ freq: 'DAILY' }), undefined), false)
			assert.equal(Recurrence.equal(new Recurrence({ freq: 'DAILY' }), new Recurrence({ freq: 'DAILY' })), true)
		})
	})

	describe('rebased', () => {
		const monday = new Date('2026-06-08T09:00:00Z')
		const tuesday = new Date('2026-06-09T09:00:00Z')

		it('is identity for a time-only move (same calendar day)', () => {
			const rule = new Recurrence({ freq: 'WEEKLY', byday: ['MO'] })
			assert.equal(rule.rebased(monday, new Date('2026-06-08T11:30:00Z')), rule)
		})

		it('measures the shift in LOCAL calendar days — an all-day snap to local midnight is not a day move', () => {
			// A timed entry converted to all-day snaps to local midnight — before the timed instant in UTC
			// for any zone ahead of it. That must not read as "moved a day earlier" and rotate the weekdays.
			const timed = new Date(2026, 5, 8, 9) // local Jun 8, 09:00
			const localMidnight = new Date(2026, 5, 8) // local Jun 8, 00:00
			const rule = new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'TU', 'WE', 'TH'] })
			assert.equal(rule.rebased(timed, localMidnight), rule)
		})

		it('rotates a weekday list with the day shift', () => {
			const rule = new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'WE'] })
			assert.deepEqual(rule.rebased(monday, tuesday).byday, ['TU', 'TH'])
			assert.deepEqual(rule.rebased(monday, tuesday).rebased(tuesday, monday).byday, ['MO', 'WE']) // round-trips
			assert.deepEqual(rule.rebased(monday, new Date('2026-06-06T09:00:00Z')).byday, ['SA', 'MO']) // -2 days wraps
		})

		it('keeps ordinal prefixes while rotating (the 2nd Tue becomes the 2nd Wed)', () => {
			assert.deepEqual(new Recurrence({ freq: 'MONTHLY', byday: ['2TU'] }).rebased(tuesday, new Date('2026-06-10T09:00:00Z')).byday, ['2WE'])
			assert.deepEqual(new Recurrence({ freq: 'MONTHLY', byday: ['-1TH'] }).rebased(monday, tuesday).byday, ['-1FR'])
		})

		it('a month-day follows the new anchor', () => {
			assert.equal(new Recurrence({ freq: 'MONTHLY', bymonthday: 8 }).rebased(monday, tuesday).bymonthday, 9)
		})

		it('leaves day-agnostic rules alone', () => {
			const daily = new Recurrence({ freq: 'DAILY', interval: 2 })
			assert.equal(daily.rebased(monday, tuesday).equals(daily), true)
		})

		it('counts the delta in the given zone, so the server\'s own zone stops mattering', () => {
			const rule = new Recurrence({ freq: 'WEEKLY', byday: ['FR'] })
			// 02:00 Berlin (00:00Z) snapping to Berlin midnight (22:00Z the previous UTC day): the same
			// Berlin day, whatever calendar the server itself lives in.
			assert.equal(rule.rebased(new Date('2026-07-10T00:00:00Z'), new Date('2026-07-09T22:00:00Z'), 'Europe/Berlin'), rule)
			// And one real Berlin day rotates exactly one weekday.
			assert.deepEqual(rule.rebased(new Date('2026-07-09T22:00:00Z'), new Date('2026-07-10T22:00:00Z'), 'Europe/Berlin').byday, ['SA'])
		})

		it('a month-day follows the anchor read in the given zone', () => {
			// Jul 10 22:00Z is already Jul 11 in Berlin — the month-day must be 11, not UTC's 10.
			const moved = new Recurrence({ freq: 'MONTHLY', bymonthday: 10 })
				.rebased(new Date('2026-07-09T22:00:00Z'), new Date('2026-07-10T22:00:00Z'), 'Europe/Berlin')
			assert.equal(moved.bymonthday, 11)
		})
	})

	describe('describe', () => {
		it('describes the common rules', () => {
			assert.equal(new Recurrence({ freq: 'DAILY' }).describe(), 'Every day')
			assert.equal(new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'TU', 'WE', 'TH', 'FR'] }).describe(), 'Every weekday')
			assert.equal(new Recurrence({ freq: 'WEEKLY', byday: ['TH'] }).describe(), 'Every week on Thu')
			assert.equal(new Recurrence({ freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE'] }).describe(), 'Every 2 weeks on Mon and Wed')
			assert.equal(new Recurrence({ freq: 'MONTHLY', bymonthday: 25 }).describe(), 'Every month on the 25th')
			assert.equal(new Recurrence({ freq: 'MONTHLY', byday: ['-1TH'] }).describe(), 'Every month on the last Thu')
			assert.equal(new Recurrence({ freq: 'MONTHLY', byday: ['4TH'] }).describe(), 'Every month on the 4th Thu')
			assert.equal(new Recurrence({ freq: 'YEARLY' }).describe(thu), 'Every year on Jun 25')
		})

		it('appends the end clause', () => {
			assert.equal(new Recurrence({ freq: 'WEEKLY', byday: ['TH'], until: Recurrence.untilFromDay(2026, 7, 18) }).describe(), 'Every week on Thu until Jul 18')
			assert.equal(new Recurrence({ freq: 'DAILY', count: 10 }).describe(), 'Every day, 10 times')
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
			const cut = new Recurrence({ freq: 'DAILY', count: 10 }).endingBefore(at('2026-06-08T09:00:00Z'))
			assert.equal(cut.count, undefined)
			assert.match(cut.toRRule(), /UNTIL=20260607T235959Z$/)
		})

		it('dayBefore is the UTC day before the instant', () => {
			assert.match(new Recurrence({ freq: 'WEEKLY', byday: ['TH'] }).endingBefore(at('2026-06-25T09:00:00Z')).toRRule(), /UNTIL=20260624T235959Z$/)
		})

		it('asContinuation keeps UNTIL and carries the REMAINING count', () => {
			const until = Recurrence.untilFromDay(2026, 12, 31)
			assert.match(new Recurrence({ freq: 'WEEKLY', byday: ['MO'], until }).asContinuation().toRRule(), /UNTIL=20261231T235959Z$/)
			// A "10 times" series split after its first occurrence continues "9 times" — never forever.
			assert.equal(new Recurrence({ freq: 'DAILY', count: 10 }).asContinuation(1).count, 9)
			assert.equal(new Recurrence({ freq: 'DAILY', count: 10 }).asContinuation(9).count, 1)
			// An unbounded rule stays unbounded, and a count never collapses below one occurrence.
			assert.equal(new Recurrence({ freq: 'DAILY' }).asContinuation(3).count, undefined)
			assert.equal(new Recurrence({ freq: 'DAILY', count: 2 }).asContinuation(5).count, 1)
		})
	})
})
