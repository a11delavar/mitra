import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Entry, EntryType, Recurrence, type Integration } from '../shared/index.js'
import { Occurrences, editOccurrence, deleteOccurrence } from './occurrences.js'

describe('Occurrences', () => {
	describe('fromICS', () => {
		const calendar = (lines: Array<string>) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...lines, 'END:VCALENDAR'].join('\r\n')
		const vevent = (props: Array<string>) => calendar(['BEGIN:VEVENT', 'UID:e1', 'DTSTAMP:20260101T000000Z', ...props, 'END:VEVENT'])
		const at = (iso: string) => new Date(iso)

		it('expands a daily event in the window, carrying its duration', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY'])
			const occ = Occurrences.fromICS(raw)!.within(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z'))
			assert.equal(occ.length, 5)
			assert.equal(occ[0]!.start.toISOString(), '2026-06-01T09:00:00.000Z')
			assert.equal(occ[0]!.end.toISOString(), '2026-06-01T09:30:00.000Z')
			assert.equal(occ[4]!.start.toISOString(), '2026-06-05T09:00:00.000Z')
		})

		it('skips EXDATEs', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY', 'EXDATE:20260602T090000Z'])
			const occ = Occurrences.fromICS(raw)!.within(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z'))
			assert.equal(occ.length, 4)
			assert.ok(!occ.some(o => o.start.toISOString() === '2026-06-02T09:00:00.000Z'))
		})

		it('returns only the in-window occurrences of a long-running series', () => {
			const raw = vevent(['DTSTART:20200101T090000Z', 'DTEND:20200101T100000Z', 'RRULE:FREQ=DAILY'])
			const occ = Occurrences.fromICS(raw)!.within(at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z'))
			assert.equal(occ.length, 3)
			assert.equal(occ[0]!.start.toISOString(), '2026-06-01T09:00:00.000Z')
		})

		it('respects COUNT — no occurrences after the series ends', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY;COUNT=3'])
			assert.equal(Occurrences.fromICS(raw)!.within(at('2026-06-10T00:00:00Z'), at('2026-06-20T00:00:00Z')).length, 0)
			assert.equal(Occurrences.fromICS(raw)!.within(at('2026-06-01T00:00:00Z'), at('2026-06-30T00:00:00Z')).length, 3)
		})

		it('expands a recurring VTODO, anchored on DTSTART with the DUE duration', () => {
			const raw = calendar(['BEGIN:VTODO', 'UID:t1', 'DTSTAMP:20260101T000000Z', 'DTSTART:20260601T090000Z', 'DUE:20260601T100000Z', 'RRULE:FREQ=DAILY', 'END:VTODO'])
			const occ = Occurrences.fromICS(raw)!.within(at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z'))
			assert.equal(occ.length, 3)
			assert.equal(occ[0]!.end.getTime() - occ[0]!.start.getTime(), 60 * 60 * 1000)
		})

		it('expands an all-day (date-only) series with day-long occurrences', () => {
			const raw = vevent(['DTSTART;VALUE=DATE:20260601', 'DTEND;VALUE=DATE:20260602', 'RRULE:FREQ=WEEKLY'])
			const occ = Occurrences.fromICS(raw)!.within(at('2026-06-01T12:00:00Z'), at('2026-06-21T12:00:00Z'))
			assert.ok(occ.length >= 2)
			assert.equal(occ[0]!.end.getTime() - occ[0]!.start.getTime(), 24 * 60 * 60 * 1000)
		})

		it('reaches a far-future window for an unbounded dense series (iteration budget)', () => {
			// ~30 years of daily occurrences (>10k iterations) must still resolve in the future window.
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY'])
			const occ = Occurrences.fromICS(raw)!.within(at('2056-06-01T00:00:00Z'), at('2056-06-03T23:59:59Z'))
			assert.equal(occ.length, 3)
		})

		it('is undefined for a non-recurring component', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z'])
			assert.equal(Occurrences.fromICS(raw), undefined)
		})

		it('expands off the MASTER even when a bundled override precedes it in document order', () => {
			// A resource bundles the master with its RECURRENCE-ID overrides in no guaranteed order —
			// read the first VEVENT blindly and an override-first resource loses its RRULE (and EXDATEs):
			// the whole series silently stops expanding.
			const raw = calendar([
				'BEGIN:VEVENT', 'UID:e1', 'DTSTAMP:20260101T000000Z',
				'RECURRENCE-ID:20260602T090000Z', 'DTSTART:20260602T120000Z', 'DTEND:20260602T123000Z',
				'END:VEVENT',
				'BEGIN:VEVENT', 'UID:e1', 'DTSTAMP:20260101T000000Z',
				'DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY', 'EXDATE:20260603T090000Z',
				'END:VEVENT',
			])
			const occ = Occurrences.fromICS(raw)!.within(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z'))
			assert.deepEqual(occ.map(o => o.start.toISOString()), [
				'2026-06-01T09:00:00.000Z',
				'2026-06-02T09:00:00.000Z', // the rule instance — the override row replaces it at render time
				'2026-06-04T09:00:00.000Z', // Jun 3 is EXDATE'd on the master
				'2026-06-05T09:00:00.000Z',
			])
		})

		it('resolves DATE exdates at the series\' zone\'s midnight — the instant the expansion produces', () => {
			// An all-day Tehran (UTC+3:30) series: occurrences are Tehran-midnight instants (20:30Z the
			// previous day). Its EXDATE;VALUE=DATE:20260608 must exclude THAT instant — read at the
			// server's own midnight (a UTC container's 00:00Z, say) it matches nothing and the excluded
			// day keeps rendering, doubled next to whatever detached copy it stood for.
			const raw = vevent(['DTSTART;VALUE=DATE:20260601', 'DTEND;VALUE=DATE:20260602', 'RRULE:FREQ=DAILY', 'EXDATE;VALUE=DATE:20260608'])
			const occ = Occurrences.fromICS(raw, { id: 'Asia/Tehran', start: at('2026-05-31T20:30:00Z') })!
				.within(at('2026-06-06T21:00:00Z'), at('2026-06-09T12:00:00Z'))
			assert.deepEqual(occ.map(o => o.start.toISOString()), [
				'2026-06-06T20:30:00.000Z', // Jun 7 Tehran
				'2026-06-08T20:30:00.000Z', // Jun 9 Tehran — Jun 8 is excluded
			])
		})
	})

	describe('fromRule (column-based, for integrations without an .ics)', () => {
		const at = (iso: string) => new Date(iso)

		it('expands a daily series from columns, carrying the start→end duration', () => {
			const occ = Occurrences.fromRule('FREQ=DAILY', at('2026-06-01T09:00:00Z'), at('2026-06-01T09:30:00Z'))!
				.within(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z'))
			assert.equal(occ.length, 5)
			assert.equal(occ[0]!.end.getTime() - occ[0]!.start.getTime(), 30 * 60 * 1000)
		})

		it('respects COUNT', () => {
			const occ = Occurrences.fromRule('FREQ=DAILY;COUNT=3', at('2026-06-01T09:00:00Z'), undefined)!
				.within(at('2026-06-01T00:00:00Z'), at('2026-06-30T00:00:00Z'))
			assert.equal(occ.length, 3)
		})

		it('skips the excluded instants', () => {
			const occ = Occurrences.fromRule('FREQ=DAILY', at('2026-06-01T09:00:00Z'), undefined, [at('2026-06-02T09:00:00Z').getTime()])!
				.within(at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z'))
			assert.equal(occ.length, 2)
		})

		it('is undefined for a malformed rule instead of throwing', () => {
			assert.equal(Occurrences.fromRule('FREQ=BOGUS', at('2026-06-01T09:00:00Z'), undefined), undefined)
		})
	})

	describe('zone-aware expansion (the entry\'s timeZone)', () => {
		const at = (iso: string) => new Date(iso)
		// Mon Jul 6 2026, 09:00 in Berlin (CEST, UTC+2) — the wall time the series repeats at.
		const berlinNineAm = at('2026-07-06T07:00:00Z')

		it('keeps the wall clock across a DST flip — 09:00 Berlin stays 09:00', () => {
			// Berlin leaves DST on Oct 25 2026: the UTC instant must shift from 07:00Z to 08:00Z.
			const occ = Occurrences.fromRule('FREQ=WEEKLY', berlinNineAm, undefined, [], 'Europe/Berlin')!
				.within(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z'))
			assert.deepEqual(occ.map(o => o.start.toISOString()), [
				'2026-10-19T07:00:00.000Z', // still CEST: 09:00 = 07:00Z
				'2026-10-26T08:00:00.000Z', // now CET: 09:00 = 08:00Z
			])
		})

		it('a series with NO authoring zone recurs at FIXED UTC instants across a DST flip, on any server', () => {
			// RFC 5545 §3.8.5.3: a UTC-form DTSTART recurs at fixed UTC instants — no DST adjustment.
			// (This replaced a server-local legacy path whose spacing depended on the container's TZ and
			// was deliberately untestable; the whole suite now runs identically under any TZ env.)
			const occ = Occurrences.fromRule('FREQ=WEEKLY', at('2026-10-19T07:00:00Z'), undefined)!
				.within(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z'))
			assert.deepEqual(occ.map(o => o.start.toISOString()), [
				'2026-10-19T07:00:00.000Z',
				'2026-10-26T07:00:00.000Z', // still 07:00Z — Berlin renders 09:00→08:00, as UTC anchoring means
			])
		})

		it('an explicit \'UTC\' zone and no zone expand identically — the round trip through a plain-Z .ics is lossless', () => {
			// A timed entry authored with timeZone 'UTC' serializes as a bare-Z DTSTART (no TZID), which
			// syncs back as timeZone null: both must mean the same fixed-instant expansion.
			const window = [at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z')] as const
			const explicit = Occurrences.fromRule('FREQ=WEEKLY', at('2026-10-19T07:00:00Z'), undefined, [], 'UTC')!.within(...window)
			const none = Occurrences.fromRule('FREQ=WEEKLY', at('2026-10-19T07:00:00Z'), undefined)!.within(...window)
			assert.deepEqual(explicit.map(o => o.start.toISOString()), none.map(o => o.start.toISOString()))
		})

		it('a FLOATING master expands at its as-if-UTC instants — the marker never reaches Temporal', () => {
			const master = new Entry({
				id: 'f', sourceId: 's', type: EntryType.Event, heading: 'Pill', timeZone: 'floating',
				start: at('2026-10-19T09:00:00Z') as never, end: at('2026-10-19T09:15:00Z') as never, // 09:00 wall, encoded as-if-UTC
				recurrence: new Recurrence({ freq: 'WEEKLY' }),
			})
			const occ = Occurrences.of(master)!.within(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z'))
			assert.deepEqual(occ.map(o => o.start.toISOString()), ['2026-10-19T09:00:00.000Z', '2026-10-26T09:00:00.000Z'])
		})

		it('an unresolvable stored zone (a pre-sanitization Microsoft name) falls back to fixed UTC instead of throwing', () => {
			const master = new Entry({
				id: 'w', sourceId: 's', type: EntryType.Event, heading: 'Sync', timeZone: 'W. Europe Standard Time',
				start: at('2026-10-19T07:00:00Z') as never, end: at('2026-10-19T08:00:00Z') as never,
				recurrence: new Recurrence({ freq: 'WEEKLY' }),
			})
			const occ = Occurrences.of(master)!.within(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z'))
			assert.equal(occ.length, 2) // a crashed read would render the whole window empty (500)
			assert.equal(occ[0]!.start.toISOString(), '2026-10-19T07:00:00.000Z')
		})

		it('overrides a UTC-written .ics anchor with the master\'s start read in its zone', () => {
			// Our own CalDAV creates store DTSTART in UTC; with the master's timeZone the expansion must
			// still be wall-clock Berlin (other clients keep reading the raw UTC until TZID is written).
			const raw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VEVENT', 'UID:z1', 'DTSTAMP:20260101T000000Z',
				'DTSTART:20260706T070000Z', 'DTEND:20260706T080000Z', 'RRULE:FREQ=WEEKLY',
				'END:VEVENT', 'END:VCALENDAR',
			].join('\r\n')
			const occ = Occurrences.fromICS(raw, { id: 'Europe/Berlin', start: berlinNineAm })!
				.within(at('2026-10-19T00:00:00Z'), at('2026-10-27T23:59:59Z'))
			assert.equal(occ[1]!.start.toISOString(), '2026-10-26T08:00:00.000Z')
			assert.equal(occ[1]!.end.getTime() - occ[1]!.start.getTime(), 60 * 60 * 1000) // duration kept
		})

		it('half-hour zones expand at their own wall clock', () => {
			// 09:00 Tehran (UTC+3:30, no DST since 2022) = 05:30Z, year-round.
			const occ = Occurrences.fromRule('FREQ=WEEKLY', at('2026-07-06T05:30:00Z'), undefined, [], 'Asia/Tehran')!
				.within(at('2026-12-01T00:00:00Z'), at('2026-12-08T23:59:59Z'))
			assert.equal(occ[0]!.start.toISOString(), '2026-12-07T05:30:00.000Z')
		})
	})
})

describe('scoped occurrence edits', () => {
	const D = (iso: string) => new Date(iso) as unknown as DateTime
	type DateTime = import('@3mo/date-time').DateTime

	const stub = () => {
		const calls = {
			updates: new Array<{ existing: Entry, incoming: Entry }>(),
			creates: new Array<Entry>(),
			deletes: new Array<Entry>(),
			excludes: new Array<number>(),
		}
		const integration = {
			updateEntry: (_em: never, existing: Entry, incoming: Entry) => (calls.updates.push({ existing, incoming }), Promise.resolve()),
			createEntry: (_em: never, entry: Entry) => (calls.creates.push(entry), Promise.resolve(entry)),
			deleteEntry: (_em: never, entry: Entry) => (calls.deletes.push(entry), Promise.resolve()),
			excludeOccurrence: (_em: never, _master: Entry, recurrenceId: Date) => (calls.excludes.push(recurrenceId.getTime()), Promise.resolve()),
		} as unknown as Integration
		return { calls, integration }
	}

	const em = {} as never
	const master = () => new Entry({
		id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1', location: 'Room A',
		start: D('2026-06-01T09:00:00Z'), end: D('2026-06-01T10:00:00Z'),
		recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['MO'] }),
	})
	const recurrenceId = new Date('2026-06-08T09:00:00Z') // the second Monday
	const edited = () => new Entry({
		sourceId: 's', type: EntryType.Event, heading: 'Edited', location: 'Room B',
		start: D('2026-06-08T10:00:00Z'), end: D('2026-06-08T11:00:00Z'), // moved one hour later
	})

	it('\'all\' shifts the whole series by the edit\'s delta and applies the fields to the master', async () => {
		const { calls, integration } = stub()
		const m = master()
		const result = await editOccurrence(em, integration, m, recurrenceId, edited(), 'all')
		assert.equal(result, m)
		assert.equal(calls.updates.length, 1)
		const { incoming } = calls.updates[0]!
		assert.equal(incoming.heading, 'Edited')
		assert.equal(incoming.location, 'Room B')
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T10:00:00.000Z') // anchor shifted +1h
		assert.equal(incoming.recurrence, m.recurrence) // the rule itself is untouched
	})

	it('\'all\' moved to another day rebases the rule so the anchor\'s own occurrence survives', async () => {
		const { calls, integration } = stub()
		const m = master()
		const movedToTuesday = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-09T09:00:00Z'), end: D('2026-06-09T10:00:00Z'), // Jun 8 Monday → Jun 9 Tuesday
		})
		await editOccurrence(em, integration, m, recurrenceId, movedToTuesday, 'all')
		const { incoming } = calls.updates[0]!
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-02T09:00:00.000Z') // anchor +1 day
		assert.deepEqual(incoming.recurrence!.byday, ['TU']) // the weekly-Monday series became weekly-Tuesday
	})

	it('\'following\' moved to another day rebases the continuation\'s rule onto its new anchor', async () => {
		const { calls, integration } = stub()
		const movedToTuesday = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-09T09:00:00Z'), end: D('2026-06-09T10:00:00Z'),
		})
		const result = await editOccurrence(em, integration, master(), recurrenceId, movedToTuesday, 'following')
		assert.deepEqual(calls.updates[0]!.incoming.recurrence!.byday, ['MO']) // the old half keeps its days
		assert.deepEqual(result.recurrence!.byday, ['TU']) // the new half repeats on its own weekday
	})

	it('\'following\' truncates the master before the occurrence and starts a continuation series at the edit', async () => {
		const { calls, integration } = stub()
		const m = master()
		const result = await editOccurrence(em, integration, m, recurrenceId, edited(), 'following')
		// Old half: same content, rule ending the day before June 8.
		assert.equal(calls.updates.length, 1)
		const truncatedRule = calls.updates[0]!.incoming.recurrence!
		assert.ok(truncatedRule.until)
		assert.ok(truncatedRule.until!.valueOf() < recurrenceId.getTime())
		assert.equal(calls.updates[0]!.incoming.location, 'Room A') // the old half keeps the master's content
		// New half: a fresh series at the edited occurrence, continuing the original cadence.
		assert.equal(calls.creates.length, 1)
		assert.equal(result, calls.creates[0])
		assert.equal(result.heading, 'Edited')
		assert.equal(result.location, 'Room B')
		assert.equal((result.start as unknown as Date).toISOString(), '2026-06-08T10:00:00.000Z')
		assert.equal(result.recurrence!.freq, 'WEEKLY')
		assert.notEqual(result.id, m.id)
	})

	it('\'following\' on a COUNT-bounded series carries the REMAINING count onto the continuation', async () => {
		// A daily "10 times" series split at its SECOND occurrence: the old half keeps occurrence #1,
		// so the continuation repeats 9 more times — it must never become a never-ending series.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1',
			start: D('2026-06-01T09:00:00Z'), end: D('2026-06-01T10:00:00Z'),
			recurrence: new Recurrence({ freq: 'DAILY', count: 10 }),
		})
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-02T10:00:00Z'), end: D('2026-06-02T11:00:00Z'), // the Jun 2 occurrence, one hour later
		})
		const result = await editOccurrence(em, integration, m, new Date('2026-06-02T09:00:00Z'), moved, 'following')
		assert.equal(result.recurrence!.count, 9)
		assert.equal(result.recurrence!.until, undefined)
		// The old half is UNTIL-bounded before the split, its COUNT cleared (UNTIL alone bounds it).
		assert.equal(calls.updates[0]!.incoming.recurrence!.count, undefined)
		assert.ok(calls.updates[0]!.incoming.recurrence!.until!.valueOf() < new Date('2026-06-02T09:00:00Z').getTime())
	})

	it('\'all\' adopts the edit\'s duration — a resized occurrence resizes the whole series', async () => {
		const { calls, integration } = stub()
		const resized = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-08T09:00:00Z'), end: D('2026-06-08T11:30:00Z'), // start untouched, 1h → 2.5h
		})
		await editOccurrence(em, integration, master(), recurrenceId, resized, 'all')
		const { incoming } = calls.updates[0]!
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T09:00:00.000Z') // anchor unmoved
		assert.equal((incoming.end as unknown as Date).toISOString(), '2026-06-01T11:30:00.000Z') // every occurrence is 2.5h now
	})

	it('\'all\' converting timed → all-day gives the series a whole-day span, not its old clock length', async () => {
		// Dragging an occurrence of a 09:00–10:00 series into the all-day lane: the edit is the day
		// itself. Shifting the stored end by the start's delta would leave a 1-hour "all-day" master —
		// invisible in the lane, but the next conversion back to timed resurrects the stale hour.
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = 'UTC'
		const allDay = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: true,
			start: D('2026-06-08T00:00:00Z'), end: D('2026-06-09T00:00:00Z'),
		})
		await editOccurrence(em, integration, m, recurrenceId, allDay, 'all')
		const { incoming } = calls.updates[0]!
		assert.equal(incoming.allDay, true)
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T00:00:00.000Z')
		assert.equal((incoming.end as unknown as Date).toISOString(), '2026-06-02T00:00:00.000Z') // midnight → next midnight
	})

	it('\'all\' converting all-day → timed adopts the edit\'s clock span — not a 24-hour event', async () => {
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = 'UTC'
		m.allDay = true
		m.start = D('2026-06-01T00:00:00Z')
		m.end = D('2026-06-02T00:00:00Z') // exclusive next midnight — a 24h stored span
		const timed = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: false,
			start: D('2026-06-08T02:00:00Z'), end: D('2026-06-08T03:00:00Z'), // dropped at 02:00, one hour
		})
		await editOccurrence(em, integration, m, new Date('2026-06-08T00:00:00Z'), timed, 'all')
		const { incoming } = calls.updates[0]!
		assert.equal(incoming.allDay, false)
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T02:00:00.000Z')
		assert.equal((incoming.end as unknown as Date).toISOString(), '2026-06-01T03:00:00.000Z') // 1h — not 02:00 the next day
	})

	it('a timed → all-day → back-to-timed round trip lands the series exactly at the released span', async () => {
		// The reported bug: a 2h daily series moved to all-day and back previewed 06:00–07:00 but saved
		// 06:00–08:00 — the master's pre-conversion length leaking through. Replay both commits.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Task, heading: 'Test', uid: 'u1', timeZone: 'UTC',
			start: D('2026-07-10T02:00:00Z'), end: D('2026-07-10T04:00:00Z'), // 2h
			recurrence: new Recurrence({ freq: 'DAILY' }),
		})
		const span = (init: Partial<Entry>) => new Entry({ sourceId: 's', type: EntryType.Task, heading: 'Test', ...init })
		const apply = (incoming: Entry) => Object.assign(m, { start: incoming.start, end: incoming.end, allDay: incoming.allDay, recurrence: incoming.recurrence })
		// 1) into the all-day lane…
		await editOccurrence(em, integration, m, new Date('2026-07-10T02:00:00Z'),
			span({ allDay: true, start: D('2026-07-10T00:00:00Z'), end: D('2026-07-11T00:00:00Z') }), 'all')
		apply(calls.updates[0]!.incoming)
		// 2) …and back onto the grid at 06:00 — the ghost previews the default one-hour slot.
		await editOccurrence(em, integration, m, new Date('2026-07-10T00:00:00Z'),
			span({ allDay: false, start: D('2026-07-10T06:00:00Z'), end: D('2026-07-10T07:00:00Z') }), 'all')
		const final = calls.updates[1]!.incoming
		assert.equal((final.start as unknown as Date).toISOString(), '2026-07-10T06:00:00.000Z')
		assert.equal((final.end as unknown as Date).toISOString(), '2026-07-10T07:00:00.000Z') // what the preview showed
	})

	it('\'all\' conversions keep the weekday rule aligned in the SERIES\' zone, not the server\'s', async () => {
		// A weekly-Friday 02:00 Berlin series (00:00Z): converting an occurrence to all-day snaps its
		// start to Berlin midnight — 22:00Z the PREVIOUS UTC day. A server counting its own (e.g. a UTC
		// container's) calendar days would read that as a day move, rotate the rule to Thursday, and
		// silently desync it from its own anchor.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1', timeZone: 'Europe/Berlin',
			start: D('2026-07-10T00:00:00Z'), end: D('2026-07-10T02:00:00Z'), // Fri 02:00–04:00 CEST
			recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['FR'] }),
		})
		const allDay = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: true,
			start: D('2026-07-09T22:00:00Z'), end: D('2026-07-10T22:00:00Z'), // Berlin midnight → next midnight
		})
		await editOccurrence(em, integration, m, new Date('2026-07-10T00:00:00Z'), allDay, 'all')
		const { incoming } = calls.updates[0]!
		assert.deepEqual(incoming.recurrence!.byday, ['FR']) // same Berlin day — no rotation
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-07-09T22:00:00.000Z')
		assert.equal((incoming.end as unknown as Date).toISOString(), '2026-07-10T22:00:00.000Z')
	})

	it('\'all\' shifts the anchor wall-clock in the master\'s zone, like the exclusions', async () => {
		// Series anchored Fri Oct 23 09:00 Berlin (CEST); the Nov 6 occurrence (CET) is dragged 2 days
		// later within CET, so the instant delta is exactly 48h — but the ANCHOR's +48h crosses the
		// Oct 25 DST end. An instant shift would beach the whole series at 08:00.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1', timeZone: 'Europe/Berlin',
			start: D('2026-10-23T07:00:00Z'), end: D('2026-10-23T08:00:00Z'), // Fri 09:00–10:00 CEST
			recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['FR'] }),
		})
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-11-08T08:00:00Z'), end: D('2026-11-08T09:00:00Z'), // Sun 09:00 CET
		})
		await editOccurrence(em, integration, m, new Date('2026-11-06T08:00:00Z'), moved, 'all') // Fri 09:00 CET
		const { incoming } = calls.updates[0]!
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-10-25T08:00:00.000Z') // Sun 09:00 CET — 09:00 stays 09:00
		assert.deepEqual(incoming.recurrence!.byday, ['SU'])
	})

	it('\'all\' shifts the exclusions along with the series; none leaves them untouched', async () => {
		{
			// A detached third Monday: its exclusion must land at the shifted instant, or the series
			// regenerates that slot right next to the detached copy.
			const { calls, integration } = stub()
			const m = master()
			m.exdates = [new Date('2026-06-15T09:00:00Z').getTime()]
			await editOccurrence(em, integration, m, recurrenceId, edited(), 'all')
			assert.deepEqual(calls.updates[0]!.incoming.exdates, [new Date('2026-06-15T10:00:00Z').getTime()])
		}
		{
			const { calls, integration } = stub()
			await editOccurrence(em, integration, master(), recurrenceId, edited(), 'all')
			assert.equal(calls.updates[0]!.incoming.exdates, undefined) // absent = keep, not "clear"
		}
	})

	it('\'all\' reads the exclusions from the raw .ics when the master keeps one', async () => {
		const { calls, integration } = stub()
		const m = master()
		m.data = {
			raw: [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z',
				'DTSTART:20260601T090000Z', 'DTEND:20260601T100000Z',
				'RRULE:FREQ=WEEKLY;BYDAY=MO', 'EXDATE:20260615T090000Z',
				'END:VEVENT', 'END:VCALENDAR',
			].join('\r\n'),
		}
		await editOccurrence(em, integration, m, recurrenceId, edited(), 'all')
		assert.deepEqual(calls.updates[0]!.incoming.exdates, [new Date('2026-06-15T10:00:00Z').getTime()])
	})

	it('\'all\' shifts the exclusions wall-clock in the master\'s zone, like the occurrences themselves', async () => {
		// A Friday 09:00 Berlin series dragged one week later, across the Oct 25 DST end: the instant
		// delta is 7d + 1h, but every occurrence — and so every exclusion — moves exactly 7 wall days.
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = 'Europe/Berlin'
		m.start = D('2026-10-23T07:00:00Z') // 09:00 CEST
		m.end = D('2026-10-23T08:00:00Z')
		m.recurrence = new Recurrence({ freq: 'WEEKLY', byday: ['FR'] })
		m.exdates = [new Date('2026-11-06T08:00:00Z').getTime()] // 09:00 CET
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-10-30T08:00:00Z'), end: D('2026-10-30T09:00:00Z'), // 09:00 CET, one week later
		})
		await editOccurrence(em, integration, m, new Date('2026-10-23T07:00:00Z'), moved, 'all')
		// 09:00 Berlin stays 09:00 Berlin — an instant shift (+7d1h) would beach it at 10:00.
		assert.deepEqual(calls.updates[0]!.incoming.exdates, [new Date('2026-11-13T08:00:00Z').getTime()])
	})

	it('\'all\' reads DATE exclusions as canonical UTC dates before shifting them (whatever the master\'s zone)', async () => {
		// All-day bounds are DATES encoded as UTC midnights (see calendarDate.ts) — the series' own
		// `timeZone` (Tehran here) governs only TIMED wall-clock math, never all-day day arithmetic:
		// read at any other midnight, the shifted exclusion lands hours off and excludes nothing.
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = 'Asia/Tehran'
		m.allDay = true
		m.start = D('2026-06-01T00:00:00Z') // all-day Mon Jun 1
		m.end = D('2026-06-02T00:00:00Z')
		m.data = {
			raw: [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z',
				'DTSTART;VALUE=DATE:20260601', 'DTEND;VALUE=DATE:20260602',
				'RRULE:FREQ=WEEKLY;BYDAY=MO', 'EXDATE;VALUE=DATE:20260615',
				'END:VEVENT', 'END:VCALENDAR',
			].join('\r\n'),
		}
		// The all-day Jun 8 occurrence dragged one day later: Jun 8 → Jun 9.
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: true,
			start: D('2026-06-09T00:00:00Z'), end: D('2026-06-10T00:00:00Z'),
		})
		await editOccurrence(em, integration, m, new Date('2026-06-08T00:00:00Z'), moved, 'all')
		// The exclusion follows by one day: all-day Jun 15 → all-day Jun 16 (both canonical UTC dates).
		assert.deepEqual(calls.updates[0]!.incoming.exdates, [new Date('2026-06-16T00:00:00Z').getTime()])
	})

	it('\'following\' carries only the exclusions at/after the split onto the continuation, shifted', async () => {
		const { calls, integration } = stub()
		const m = master()
		m.exdates = [
			new Date('2026-06-01T09:00:00Z').getTime(), // before the split — stays the old half's
			new Date('2026-06-15T09:00:00Z').getTime(), // after it — the continuation's, at +1h
		]
		const result = await editOccurrence(em, integration, m, recurrenceId, edited(), 'following')
		assert.equal(calls.updates[0]!.incoming.exdates, undefined) // the old half keeps its own untouched
		assert.deepEqual(result.exdates, [new Date('2026-06-15T10:00:00Z').getTime()])
	})

	it('\'this\' excludes the occurrence and detaches it as a standalone entry', async () => {
		const { calls, integration } = stub()
		const result = await editOccurrence(em, integration, master(), recurrenceId, edited(), 'this')
		assert.deepEqual(calls.excludes, [recurrenceId.getTime()])
		assert.equal(calls.creates.length, 1)
		assert.equal(result.heading, 'Edited')
		assert.equal(result.recurrence, undefined) // a standalone — no rule, no series link
		assert.equal(result.recurrenceMasterId, undefined)
	})

	it('scoped deletes: all → master, following → truncate, this → exclude', async () => {
		{
			const { calls, integration } = stub()
			const m = master()
			await deleteOccurrence(em, integration, m, recurrenceId, 'all')
			assert.deepEqual(calls.deletes, [m])
		}
		{
			const { calls, integration } = stub()
			await deleteOccurrence(em, integration, master(), recurrenceId, 'following')
			assert.equal(calls.updates.length, 1)
			assert.ok(calls.updates[0]!.incoming.recurrence!.until!.valueOf() < recurrenceId.getTime())
		}
		{
			const { calls, integration } = stub()
			await deleteOccurrence(em, integration, master(), recurrenceId, 'this')
			assert.deepEqual(calls.excludes, [recurrenceId.getTime()])
		}
	})
})
