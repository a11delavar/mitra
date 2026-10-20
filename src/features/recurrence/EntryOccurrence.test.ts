import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryTimeZone, EntryType, Entry, EntryPatch } from '#features/entries'
import type { Integration } from '#integrations'
import { Recurrence } from './Recurrence.js'
import { RecurrenceFrequency } from './RecurrenceFrequency.js'
import { RecurrenceWeekday } from './RecurrenceWeekday.js'
import { EntryOccurrenceChangeScope } from './EntryOccurrenceChange.js'

describe('EntryOccurrence edits', () => {
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
	/** `edited` is the occurrence as the edit leaves it. */
	const edit = (entry: Entry, recurrenceId: Date, edited: Entry, scope: EntryOccurrenceChangeScope) => entry.occurrences.at(recurrenceId).edit(EntryPatch.of(edited, EntryPatch.occurrence), scope)
	const master = () => new Entry({
		id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1', location: 'Room A',
		start: D('2026-06-01T09:00:00Z'), end: D('2026-06-01T10:00:00Z'),
		recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday] }),
	})
	const recurrenceId = new Date('2026-06-08T09:00:00Z') // the second Monday
	const edited = () => new Entry({
		sourceId: 's', type: EntryType.Event, heading: 'Edited', location: 'Room B',
		start: D('2026-06-08T10:00:00Z'), end: D('2026-06-08T11:00:00Z'), // moved one hour later
	})

	it('\'all\' shifts the whole series by the edit\'s delta and applies the fields to the master', async () => {
		const { calls, integration } = stub()
		const m = master()
		const result = await edit(m, recurrenceId, edited(), EntryOccurrenceChangeScope.All).save(em, integration)
		assert.equal(result, m)
		assert.equal(calls.updates.length, 1)
		const { incoming } = calls.updates[0]!
		assert.equal(incoming.heading, 'Edited')
		assert.equal(incoming.location, 'Room B')
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T10:00:00.000Z') // anchor shifted +1h
		assert.equal(incoming.recurrence, m.recurrence) // the rule itself is untouched
	})

	it('\'this\' may drop the date a rule repeats from, as its occurrence leaves the rule', async () => {
		const { calls, integration } = stub()
		const detached = await edit(master(), recurrenceId, new Entry({ sourceId: 's', type: EntryType.Task, heading: 'Standup' }), EntryOccurrenceChangeScope.This).save(em, integration)
		assert.equal(detached.start, undefined)
		assert.deepEqual(calls.excludes, [recurrenceId.getTime()])
	})

	it('at() reads the occurrence itself, not the master it expands from', () => {
		const occurrence = master().occurrences.at(recurrenceId)
		assert.equal(occurrence.start?.toISOString(), '2026-06-08T09:00:00.000Z')
		assert.equal(occurrence.end?.toISOString(), '2026-06-08T10:00:00.000Z')
	})

	it('\'all\' moved to another day rebases the rule so the anchor\'s own occurrence survives', async () => {
		const { calls, integration } = stub()
		const m = master()
		const movedToTuesday = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-09T09:00:00Z'), end: D('2026-06-09T10:00:00Z'), // Jun 8 Monday → Jun 9 Tuesday
		})
		await edit(m, recurrenceId, movedToTuesday, EntryOccurrenceChangeScope.All).save(em, integration)
		const { incoming } = calls.updates[0]!
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-02T09:00:00.000Z') // anchor +1 day
		assert.deepEqual(incoming.recurrence!.byday?.map(String), ['TU']) // the weekly-Monday series became weekly-Tuesday
	})

	it('\'following\' moved to another day rebases the continuation\'s rule onto its new anchor', async () => {
		const { calls, integration } = stub()
		const movedToTuesday = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-09T09:00:00Z'), end: D('2026-06-09T10:00:00Z'),
		})
		const result = await edit(master(), recurrenceId, movedToTuesday, EntryOccurrenceChangeScope.Following).save(em, integration)
		assert.deepEqual(calls.updates[0]!.incoming.recurrence!.byday?.map(String), ['MO']) // the old half keeps its days
		assert.deepEqual(result.recurrence!.byday?.map(String), ['TU']) // the new half repeats on its own weekday
	})

	it('\'following\' truncates the master before the occurrence and starts a continuation series at the edit', async () => {
		const { calls, integration } = stub()
		const m = master()
		const result = await edit(m, recurrenceId, edited(), EntryOccurrenceChangeScope.Following).save(em, integration)
		// Old half: same content, rule ending the day before June 8.
		assert.equal(calls.updates.length, 1)
		const truncatedRule = calls.updates[0]!.incoming.recurrence!
		assert.ok(truncatedRule.until)
		assert.ok(truncatedRule.until!.instant.valueOf() < recurrenceId.getTime())
		assert.equal(calls.updates[0]!.incoming.location, 'Room A') // the old half keeps the master's content
		// New half: a fresh series at the edited occurrence, continuing the original cadence.
		assert.equal(calls.creates.length, 1)
		assert.equal(result, calls.creates[0])
		assert.equal(result.heading, 'Edited')
		assert.equal(result.location, 'Room B')
		assert.equal((result.start as unknown as Date).toISOString(), '2026-06-08T10:00:00.000Z')
		assert.equal(result.recurrence!.freq, RecurrenceFrequency.Weekly)
		assert.notEqual(result.id, m.id)
	})

	it('\'following\' on a COUNT-bounded series carries the REMAINING count onto the continuation', async () => {
		// A daily "10 times" series split at its SECOND occurrence: the old half keeps occurrence #1,
		// so the continuation repeats 9 more times. It must never become a never-ending series.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1',
			start: D('2026-06-01T09:00:00Z'), end: D('2026-06-01T10:00:00Z'),
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily, count: 10 }),
		})
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-02T10:00:00Z'), end: D('2026-06-02T11:00:00Z'), // the Jun 2 occurrence, one hour later
		})
		const result = await edit(m, new Date('2026-06-02T09:00:00Z'), moved, EntryOccurrenceChangeScope.Following).save(em, integration)
		assert.equal(result.recurrence!.count, 9)
		assert.equal(result.recurrence!.until, undefined)
		// The old half is UNTIL-bounded before the split, its COUNT cleared (UNTIL alone bounds it).
		assert.equal(calls.updates[0]!.incoming.recurrence!.count, undefined)
		assert.ok(calls.updates[0]!.incoming.recurrence!.until!.instant.valueOf() < new Date('2026-06-02T09:00:00Z').getTime())
	})

	it('\'all\' adopts the edit\'s duration: a resized occurrence resizes the whole series', async () => {
		const { calls, integration } = stub()
		const resized = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-06-08T09:00:00Z'), end: D('2026-06-08T11:30:00Z'), // start untouched, 1h → 2.5h
		})
		await edit(master(), recurrenceId, resized, EntryOccurrenceChangeScope.All).save(em, integration)
		const { incoming } = calls.updates[0]!
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T09:00:00.000Z') // anchor unmoved
		assert.equal((incoming.end as unknown as Date).toISOString(), '2026-06-01T11:30:00.000Z') // every occurrence is 2.5h now
	})

	it('\'all\' makes a series of moments of a task whose occurrence lost its end', async () => {
		const { calls, integration } = stub()
		const task = (end?: DateTime) => new Entry({
			id: 'm', sourceId: 's', type: EntryType.Task, heading: 'Water the plants', uid: 'u1',
			start: D('2026-06-01T09:00:00Z'), end, recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday] }),
		})
		const moment = new Entry({ sourceId: 's', type: EntryType.Task, heading: 'Water the plants', start: D('2026-06-08T09:00:00Z') })
		await edit(task(D('2026-06-01T10:00:00Z')), recurrenceId, moment, EntryOccurrenceChangeScope.All).save(em, integration)
		const { incoming } = calls.updates[0]!
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T09:00:00.000Z')
		assert.equal(incoming.end, undefined)
		assert.equal(incoming.point, true)
	})

	it('\'all\' converting timed → all-day gives the series a whole-day span, not its old clock length', async () => {
		// Dragging an occurrence of a 09:00–10:00 series into the all-day lane: the edit is the day
		// itself. Shifting the stored end by the start's delta would leave a 1-hour "all-day" master,
		// invisible in the lane, but the next conversion back to timed resurrects the stale hour.
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = EntryTimeZone.parse('UTC')
		const allDay = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: true,
			start: D('2026-06-08T00:00:00Z'), end: D('2026-06-09T00:00:00Z'),
		})
		await edit(m, recurrenceId, allDay, EntryOccurrenceChangeScope.All).save(em, integration)
		const { incoming } = calls.updates[0]!
		assert.equal(incoming.allDay, true)
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T00:00:00.000Z')
		assert.equal((incoming.end as unknown as Date).toISOString(), '2026-06-02T00:00:00.000Z') // midnight → next midnight
	})

	it('\'all\' converting all-day → timed adopts the edit\'s clock span, not a 24-hour event', async () => {
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = EntryTimeZone.parse('UTC')
		m.allDay = true
		m.start = D('2026-06-01T00:00:00Z')
		m.end = D('2026-06-02T00:00:00Z') // exclusive next midnight, a 24h stored span
		const timed = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: false,
			start: D('2026-06-08T02:00:00Z'), end: D('2026-06-08T03:00:00Z'), // dropped at 02:00, one hour
		})
		await edit(m, new Date('2026-06-08T00:00:00Z'), timed, EntryOccurrenceChangeScope.All).save(em, integration)
		const { incoming } = calls.updates[0]!
		assert.equal(incoming.allDay, false)
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-06-01T02:00:00.000Z')
		assert.equal((incoming.end as unknown as Date).toISOString(), '2026-06-01T03:00:00.000Z') // 1h, not 02:00 the next day
	})

	it('a timed → all-day → back-to-timed round trip lands the series exactly at the released span', async () => {
		// The reported bug: a 2h daily series moved to all-day and back previewed 06:00–07:00 but saved
		// 06:00–08:00: the master's pre-conversion length leaking through. Replay both commits.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Task, heading: 'Test', uid: 'u1', timeZone: EntryTimeZone.parse('UTC'),
			start: D('2026-07-10T02:00:00Z'), end: D('2026-07-10T04:00:00Z'), // 2h
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }),
		})
		const span = (init: Partial<Entry>) => new Entry({ sourceId: 's', type: EntryType.Task, heading: 'Test', ...init })
		const apply = (incoming: Entry) => Object.assign(m, { start: incoming.start, end: incoming.end, allDay: incoming.allDay, recurrence: incoming.recurrence })
		// 1) into the all-day lane…
		await edit(m, new Date('2026-07-10T02:00:00Z'), span({ allDay: true, start: D('2026-07-10T00:00:00Z'), end: D('2026-07-11T00:00:00Z') }), EntryOccurrenceChangeScope.All).save(em, integration)
		apply(calls.updates[0]!.incoming)
		// 2) …and back onto the grid at 06:00, where the ghost previews the default one-hour slot.
		await edit(m, new Date('2026-07-10T00:00:00Z'), span({ allDay: false, start: D('2026-07-10T06:00:00Z'), end: D('2026-07-10T07:00:00Z') }), EntryOccurrenceChangeScope.All).save(em, integration)
		const final = calls.updates[1]!.incoming
		assert.equal((final.start as unknown as Date).toISOString(), '2026-07-10T06:00:00.000Z')
		assert.equal((final.end as unknown as Date).toISOString(), '2026-07-10T07:00:00.000Z') // what the preview showed
	})

	it('\'all\' moves a timed series into the all-day lane by the days in its own zone, onto their UTC midnights', async () => {
		// Friday 00:30 Berlin is Thursday 22:30Z: a server reading its own (UTC) days would rotate the rule to Thursday,
		// and one shifting the instant would store 22:30Z as a day.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1', timeZone: EntryTimeZone.parse('Europe/Berlin'),
			start: D('2026-07-02T22:30:00Z'), end: D('2026-07-02T23:30:00Z'), // Fri Jul 3, 00:30–01:30 CEST
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Friday] }),
		})
		const allDay = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: true,
			start: D('2026-07-10T00:00:00Z'), end: D('2026-07-11T00:00:00Z'), // Friday Jul 10, as days arrive
		})
		await edit(m, new Date('2026-07-09T22:30:00Z'), allDay, EntryOccurrenceChangeScope.All).save(em, integration)
		const { incoming } = calls.updates[0]!
		assert.deepEqual(incoming.recurrence!.byday?.map(String), ['FR'])
		assert.deepEqual([incoming.start, incoming.end].map(date => (date as unknown as Date).toISOString()), ['2026-07-03T00:00:00.000Z', '2026-07-04T00:00:00.000Z'])
	})

	it('\'all\' moves an all-day series into the hours by the days where it was dropped', async () => {
		// Tuesday 00:30 Berlin is still Monday in UTC, where the all-day dates are: the rule moves to Tuesday.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1', allDay: true,
			start: D('2026-06-01T00:00:00Z'), end: D('2026-06-02T00:00:00Z'),
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Monday] }),
		})
		const timed = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', timeZone: EntryTimeZone.parse('Europe/Berlin'),
			start: D('2026-06-08T22:30:00Z'), end: D('2026-06-08T23:30:00Z'), // Tue Jun 9, 00:30–01:30 CEST
		})
		await edit(m, new Date('2026-06-08T00:00:00Z'), timed, EntryOccurrenceChangeScope.All).save(em, integration)
		const { incoming } = calls.updates[0]!
		assert.deepEqual(incoming.recurrence!.byday?.map(String), ['TU'])
		assert.deepEqual([incoming.allDay, ...[incoming.start, incoming.end].map(date => (date as unknown as Date).toISOString())], [false, '2026-06-01T22:30:00.000Z', '2026-06-01T23:30:00.000Z'])
	})

	it('\'all\' shifts the anchor wall-clock in the master\'s zone, like the exclusions', async () => {
		// Series anchored Fri Oct 23 09:00 Berlin (CEST); the Nov 6 occurrence (CET) is dragged 2 days
		// later within CET, so the instant delta is exactly 48h, but the ANCHOR's +48h crosses the
		// Oct 25 DST end. An instant shift would beach the whole series at 08:00.
		const { calls, integration } = stub()
		const m = new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Standup', uid: 'u1', timeZone: EntryTimeZone.parse('Europe/Berlin'),
			start: D('2026-10-23T07:00:00Z'), end: D('2026-10-23T08:00:00Z'), // Fri 09:00–10:00 CEST
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Friday] }),
		})
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-11-08T08:00:00Z'), end: D('2026-11-08T09:00:00Z'), // Sun 09:00 CET
		})
		await edit(m, new Date('2026-11-06T08:00:00Z'), moved, EntryOccurrenceChangeScope.All).save(em, integration) // Fri 09:00 CET
		const { incoming } = calls.updates[0]!
		assert.equal((incoming.start as unknown as Date).toISOString(), '2026-10-25T08:00:00.000Z') // Sun 09:00 CET: 09:00 stays 09:00
		assert.deepEqual(incoming.recurrence!.byday?.map(String), ['SU'])
	})

	it('\'all\' shifts the exclusions along with the series; none leaves them untouched', async () => {
		{
			// A detached third Monday: its exclusion must land at the shifted instant, or the series
			// regenerates that slot right next to the detached copy.
			const { calls, integration } = stub()
			const m = master()
			m.exdates = [new Date('2026-06-15T09:00:00Z').getTime()]
			await edit(m, recurrenceId, edited(), EntryOccurrenceChangeScope.All).save(em, integration)
			assert.deepEqual(calls.updates[0]!.incoming.exdates, [new Date('2026-06-15T10:00:00Z').getTime()])
		}
		{
			const { calls, integration } = stub()
			await edit(master(), recurrenceId, edited(), EntryOccurrenceChangeScope.All).save(em, integration)
			assert.equal(calls.updates[0]!.incoming.exdates, undefined) // absent = keep, not "clear"
		}
	})

	it('\'all\' shifts the exclusions wall-clock in the master\'s zone, like the occurrences themselves', async () => {
		// A Friday 09:00 Berlin series dragged one week later, across the Oct 25 DST end: the instant
		// delta is 7d + 1h, but every occurrence (and so every exclusion) moves exactly 7 wall days.
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = EntryTimeZone.parse('Europe/Berlin')
		m.start = D('2026-10-23T07:00:00Z') // 09:00 CEST
		m.end = D('2026-10-23T08:00:00Z')
		m.recurrence = new Recurrence({ freq: RecurrenceFrequency.Weekly, byday: [RecurrenceWeekday.Friday] })
		m.exdates = [new Date('2026-11-06T08:00:00Z').getTime()] // 09:00 CET
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup',
			start: D('2026-10-30T08:00:00Z'), end: D('2026-10-30T09:00:00Z'), // 09:00 CET, one week later
		})
		await edit(m, new Date('2026-10-23T07:00:00Z'), moved, EntryOccurrenceChangeScope.All).save(em, integration)
		// 09:00 Berlin stays 09:00 Berlin: an instant shift (+7d1h) would beach it at 10:00.
		assert.deepEqual(calls.updates[0]!.incoming.exdates, [new Date('2026-11-13T08:00:00Z').getTime()])
	})

	it('\'all\' shifts an all-day entry\'s exclusions by whole UTC days, whatever its zone', async () => {
		// All-day dates are UTC midnights; the entry's zone governs only timed wall-clock math.
		const { calls, integration } = stub()
		const m = master()
		m.timeZone = EntryTimeZone.parse('Asia/Tehran')
		m.allDay = true
		m.start = D('2026-06-01T00:00:00Z') // all-day Mon Jun 1
		m.end = D('2026-06-02T00:00:00Z')
		m.exdates = [Date.parse('2026-06-15T00:00:00Z')]
		// The all-day Jun 8 occurrence dragged one day later: Jun 8 to Jun 9.
		const moved = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Standup', allDay: true,
			start: D('2026-06-09T00:00:00Z'), end: D('2026-06-10T00:00:00Z'),
		})
		await edit(m, new Date('2026-06-08T00:00:00Z'), moved, EntryOccurrenceChangeScope.All).save(em, integration)
		assert.deepEqual(calls.updates[0]!.incoming.exdates, [new Date('2026-06-16T00:00:00Z').getTime()])
	})

	it('\'following\' carries only the exclusions at/after the split onto the continuation, shifted', async () => {
		const { calls, integration } = stub()
		const m = master()
		m.exdates = [
			new Date('2026-06-01T09:00:00Z').getTime(), // before the split, stays the old half's
			new Date('2026-06-15T09:00:00Z').getTime(), // after it, the continuation's, at +1h
		]
		const result = await edit(m, recurrenceId, edited(), EntryOccurrenceChangeScope.Following).save(em, integration)
		assert.equal(calls.updates[0]!.incoming.exdates, undefined) // the old half keeps its own untouched
		assert.deepEqual(result.exdates, [new Date('2026-06-15T10:00:00Z').getTime()])
	})

	it('\'this\' excludes the occurrence and detaches it as a standalone entry', async () => {
		const { calls, integration } = stub()
		const result = await edit(master(), recurrenceId, edited(), EntryOccurrenceChangeScope.This).save(em, integration)
		assert.deepEqual(calls.excludes, [recurrenceId.getTime()])
		assert.equal(calls.creates.length, 1)
		assert.equal(result.heading, 'Edited')
		assert.equal(result.recurrence, undefined) // a standalone: no rule, no series link
		assert.equal(result.recurringEntryId, undefined)
	})

	describe('a scoped edit that also changes the calendar', () => {
		it('\'this\' detaches the occurrence INTO the other calendar', async () => {
			const here = stub()
			const there = stub()
			const result = await edit(master(), recurrenceId, Object.assign(edited(), { sourceId: 'other' }), EntryOccurrenceChangeScope.This).save(em, here.integration, there.integration)
			assert.deepEqual(here.calls.excludes, [recurrenceId.getTime()], 'the occurrence still leaves the series here')
			assert.equal(here.calls.creates.length, 0, 'and nothing is created here')
			assert.equal(there.calls.creates.length, 1)
			assert.equal(result.sourceId, 'other')
		})

		it('\'following\' starts the continuation there and leaves the old half where it is', async () => {
			const here = stub()
			const there = stub()
			const result = await edit(master(), recurrenceId, Object.assign(edited(), { sourceId: 'other' }), EntryOccurrenceChangeScope.Following).save(em, here.integration, there.integration)
			assert.equal(here.calls.updates.length, 1, 'the old half is truncated in place')
			assert.equal(here.calls.updates[0]!.incoming.sourceId, 's')
			assert.equal(there.calls.creates.length, 1)
			assert.equal(result.sourceId, 'other')
			assert.ok(result.recurrence, 'the continuation is still a series')
		})

		it('\'all\' re-creates the whole series there and only then deletes it here', async () => {
			const here = stub()
			const there = stub()
			const m = master()
			const result = await edit(m, recurrenceId, Object.assign(edited(), { sourceId: 'other' }), EntryOccurrenceChangeScope.All).save(em, here.integration, there.integration)
			assert.equal(there.calls.creates.length, 1)
			assert.deepEqual(here.calls.deletes, [m], 'the original goes, and only after the copy landed')
			assert.equal(result.sourceId, 'other')
			assert.equal(result.uid, m.uid, 'the series keeps its identity, so every link to it still resolves')
			assert.equal(result.heading, 'Edited', 'and the edit rode along with the move')
			assert.ok(result.recurrence, 'the rule travels with it')
		})

		it('\'all\' takes the copy back when the original cannot be deleted: a duplicate beats a loss', async () => {
			const here = stub()
			const there = stub()
			here.integration.deleteEntry = () => Promise.reject(new Error('nope'))
			await assert.rejects(() => edit(master(), recurrenceId, Object.assign(edited(), { sourceId: 'other' }), EntryOccurrenceChangeScope.All).save(em, here.integration, there.integration))
			assert.equal(there.calls.deletes.length, 1, 'the copy is compensated')
		})
	})

	it('scoped deletes: all → master, following → truncate, this → exclude', async () => {
		{
			const { calls, integration } = stub()
			const m = master()
			await m.occurrences.at(recurrenceId).delete(EntryOccurrenceChangeScope.All).save(em, integration)
			assert.deepEqual(calls.deletes, [m])
		}
		{
			const { calls, integration } = stub()
			await master().occurrences.at(recurrenceId).delete(EntryOccurrenceChangeScope.Following).save(em, integration)
			assert.equal(calls.updates.length, 1)
			assert.ok(calls.updates[0]!.incoming.recurrence!.until!.instant.valueOf() < recurrenceId.getTime())
		}
		{
			const { calls, integration } = stub()
			await master().occurrences.at(recurrenceId).delete(EntryOccurrenceChangeScope.This).save(em, integration)
			assert.deepEqual(calls.excludes, [recurrenceId.getTime()])
		}
	})
})
