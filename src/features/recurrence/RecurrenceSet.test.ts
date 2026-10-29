import { describe, it } from 'node:test'
import { DateTimeRange } from '@3mo/date-time'
import assert from 'node:assert/strict'
import { EntryType, Entry } from '#features/entries'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { TimeZone } from '#features/time/TimeZone.js'
import { Recurrence } from './Recurrence.js'
import { RecurrenceSet } from './RecurrenceSet.js'
import { RecurrenceFrequency } from './RecurrenceFrequency.js'

describe('RecurrenceSet', () => {
	describe('fromRule', () => {
		const at = (iso: string) => new Date(iso)

		it('expands a daily series from columns, carrying the start→end duration', () => {
			const occ = RecurrenceSet.fromRule('FREQ=DAILY', at('2026-06-01T09:00:00Z'), at('2026-06-01T09:30:00Z'))!
				.within(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z'))
			assert.equal(occ.length, 5)
			assert.equal(occ[0]!.end.getTime() - occ[0]!.start.getTime(), 30 * 60 * 1000)
		})

		it('respects COUNT', () => {
			const occ = RecurrenceSet.fromRule('FREQ=DAILY;COUNT=3', at('2026-06-01T09:00:00Z'), undefined)!
				.within(at('2026-06-01T00:00:00Z'), at('2026-06-30T00:00:00Z'))
			assert.equal(occ.length, 3)
		})

		it('skips the excluded instants', () => {
			const occ = RecurrenceSet.fromRule('FREQ=DAILY', at('2026-06-01T09:00:00Z'), undefined, [at('2026-06-02T09:00:00Z').getTime()])!
				.within(at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z'))
			assert.equal(occ.length, 2)
		})

		it('is undefined for a malformed rule instead of throwing', () => {
			assert.equal(RecurrenceSet.fromRule('FREQ=BOGUS', at('2026-06-01T09:00:00Z'), undefined), undefined)
		})
	})

	describe('zone-aware expansion (the entry\'s timeZone)', () => {
		const at = (iso: string) => new Date(iso)
		// Mon Jul 6 2026, 09:00 in Berlin (CEST, UTC+2), the wall time the series repeats at.
		const berlinNineAm = at('2026-07-06T07:00:00Z')

		it('keeps the wall clock across a DST flip: 09:00 Berlin stays 09:00', () => {
			// Berlin leaves DST on Oct 25 2026: the UTC instant must shift from 07:00Z to 08:00Z.
			const occ = RecurrenceSet.fromRule('FREQ=WEEKLY', berlinNineAm, undefined, [], TimeZone.of('Europe/Berlin'))!
				.within(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z'))
			assert.deepEqual(occ.map(o => o.start.toISOString()), [
				'2026-10-19T07:00:00.000Z', // still CEST: 09:00 = 07:00Z
				'2026-10-26T08:00:00.000Z', // now CET: 09:00 = 08:00Z
			])
		})

		it('a series with NO authoring zone recurs at FIXED UTC instants across a DST flip, on any server', () => {
			// RFC 5545 §3.8.5.3: a UTC-form DTSTART recurs at fixed UTC instants, no DST adjustment.
			// (This replaced a server-local legacy path whose spacing depended on the container's TZ and
			// was deliberately untestable; the whole suite now runs identically under any TZ env.)
			const occ = RecurrenceSet.fromRule('FREQ=WEEKLY', at('2026-10-19T07:00:00Z'), undefined)!
				.within(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z'))
			assert.deepEqual(occ.map(o => o.start.toISOString()), [
				'2026-10-19T07:00:00.000Z',
				'2026-10-26T07:00:00.000Z', // still 07:00Z. Berlin renders 09:00→08:00, as UTC anchoring means
			])
		})

		it('an explicit \'UTC\' zone and no zone expand identically: the round trip through a plain-Z .ics is lossless', () => {
			// A timed entry authored with timeZone 'UTC' serializes as a bare-Z DTSTART (no TZID), which
			// syncs back as timeZone null: both must mean the same fixed-instant expansion.
			const window = [at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z')] as const
			const explicit = RecurrenceSet.fromRule('FREQ=WEEKLY', at('2026-10-19T07:00:00Z'), undefined, [], TimeZone.of('UTC'))!.within(...window)
			const none = RecurrenceSet.fromRule('FREQ=WEEKLY', at('2026-10-19T07:00:00Z'), undefined)!.within(...window)
			assert.deepEqual(explicit.map(o => o.start.toISOString()), none.map(o => o.start.toISOString()))
		})

		it('a FLOATING master expands at its as-if-UTC instants: the marker never reaches Temporal', () => {
			const master = new Entry({
				id: 'f', sourceId: 's', type: EntryType.Event, heading: 'Pill', timeZone: EntryTimeZone.parse('floating'),
				start: at('2026-10-19T09:00:00Z') as never, end: at('2026-10-19T09:15:00Z') as never, // 09:00 wall, encoded as-if-UTC
				recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }),
			})
			const occ = master.occurrences.within(new DateTimeRange(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z')))
			assert.deepEqual(occ.map(o => o.start?.toISOString()), ['2026-10-19T09:00:00.000Z', '2026-10-26T09:00:00.000Z'])
		})

		it('an unresolvable stored zone (a pre-sanitization Microsoft name) falls back to fixed UTC instead of throwing', () => {
			const master = new Entry({
				id: 'w', sourceId: 's', type: EntryType.Event, heading: 'Sync', timeZone: new EntryTimeZone.Mapper().convertToJSValue('W. Europe Standard Time') ?? undefined,
				start: at('2026-10-19T07:00:00Z') as never, end: at('2026-10-19T08:00:00Z') as never,
				recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }),
			})
			const occ = master.occurrences.within(new DateTimeRange(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z')))
			assert.equal(occ.length, 2) // a crashed read would render the whole window empty (500)
			assert.equal(occ[0]!.start?.toISOString(), '2026-10-19T07:00:00.000Z')
		})

		it('half-hour zones expand at their own wall clock', () => {
			// 09:00 Tehran (UTC+3:30, no DST since 2022) = 05:30Z, year-round.
			const occ = RecurrenceSet.fromRule('FREQ=WEEKLY', at('2026-07-06T05:30:00Z'), undefined, [], TimeZone.of('Asia/Tehran'))!
				.within(at('2026-12-01T00:00:00Z'), at('2026-12-08T23:59:59Z'))
			assert.equal(occ[0]!.start.toISOString(), '2026-12-07T05:30:00.000Z')
		})
	})
})
