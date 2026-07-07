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

		// (No test pins the ZONELESS path's spacing across a DST flip on purpose: it iterates the
		// SERVER's wall clock, so the result depends on where the server runs — the very
		// non-determinism the entry's own timeZone exists to remove.)

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
