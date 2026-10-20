import { describe, it } from 'node:test'
import { DateTimeRange } from '@3mo/date-time'
import ICAL from 'ical.js'
import assert from 'node:assert/strict'
import { EntryType, Entry, EntryRank, EntryTimeZone } from '#features/entries'
import { CalDAV } from '#integrations/caldav/CalDAV.js'
import { Recurrence } from './Recurrence.js'
import { RecurrenceFrequency } from './RecurrenceFrequency.js'

type DateTime = import('@3mo/date-time').DateTime
const D = (iso: string) => new Date(iso) as unknown as DateTime

describe('EntryOccurrences', () => {
	const at = (iso: string) => new Date(iso) as unknown as DateTime
	const weekly = () => new Entry({
		id: 'standup', sourceId: 's', type: EntryType.Event, heading: 'Standup',
		start: at('2026-10-19T09:00:00Z'), end: at('2026-10-19T09:15:00Z'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }),
	})

	it('yields a one-off entry once, with its own dates', () => {
		const talk = new Entry({ id: 'talk', sourceId: 's', type: EntryType.Event, heading: 'Talk', start: at('2026-10-21T09:00:00Z'), end: at('2026-10-21T10:00:00Z') })
		const occurrences = talk.occurrences.within(new DateTimeRange(at('2026-10-01T00:00:00Z'), at('2026-11-01T00:00:00Z')))
		assert.equal(occurrences.length, 1)
		assert.equal(occurrences[0]!.entry, talk)
		assert.equal(occurrences[0]!.start, talk.start)
		assert.equal(occurrences[0]!.recurrenceId, undefined)
		assert.equal(occurrences[0]!.key, 'talk')
	})

	it('finds the occurrence a request names, refusing a date the rule never takes and an entry that does not repeat', () => {
		const standup = weekly()
		assert.equal(standup.occurrences.existing(at('2026-10-26T09:00:00Z')).start?.toISOString(), '2026-10-26T09:00:00.000Z')
		assert.throws(() => standup.occurrences.existing(at('2026-10-27T09:00:00Z')), /takes no place/)
		const talk = new Entry({ id: 'talk', sourceId: 's', type: EntryType.Event, heading: 'Talk', start: at('2026-10-21T09:00:00Z'), end: at('2026-10-21T10:00:00Z') })
		assert.throws(() => talk.occurrences.existing(at('2026-10-21T09:00:00Z')), /does not repeat/)
	})

	it('reaches any window of an endless rule', () => {
		const dates = weekly().occurrences.within(new DateTimeRange(at('2030-01-01T00:00:00Z'), at('2030-01-15T00:00:00Z'))).map(occurrence => occurrence.start?.toISOString())
		assert.deepEqual(dates, ['2030-01-07T09:00:00.000Z', '2030-01-14T09:00:00.000Z'])
	})

	it('yields the same instance for the same date, and new ones once the rule changes', () => {
		const standup = weekly()
		const window = new DateTimeRange(at('2026-10-19T00:00:00Z'), at('2026-10-27T00:00:00Z'))
		const [first] = standup.occurrences.within(window)
		assert.equal(standup.occurrences.within(window)[0], first)
		assert.equal(standup.occurrences.at(at('2026-10-19T09:00:00Z')), first)
		standup.recurrence = new Recurrence({ freq: RecurrenceFrequency.Daily })
		assert.notEqual(standup.occurrences.within(window)[0], first)
		assert.equal(standup.occurrences.within(window).length, 8)
	})

	it('points back to its entry and knows the first', () => {
		const standup = weekly()
		const [first, second] = [standup.occurrences.at(at('2026-10-19T09:00:00Z')), standup.occurrences.at(at('2026-10-26T09:00:00Z'))]
		assert.equal(first!.entry, standup)
		assert.equal(first!.first, true)
		assert.equal(second!.first, false)
		assert.equal(second!.key, `standup__${Date.parse('2026-10-26T09:00:00Z')}`)
	})

	it('overrides its date with what the recurring entry holds, under its key', () => {
		const second = weekly().occurrences.at(at('2026-10-26T09:00:00Z'))
		const override = second.override()
		assert.deepEqual([override.id, override.recurringEntryId, override.recurrenceId?.toISOString(), override.start?.toISOString(), override.heading], [second.key, 'standup', '2026-10-26T09:00:00.000Z', '2026-10-26T09:00:00.000Z', 'Standup'])
		assert.equal(override.occurrences.recurring, false)
	})

	// RFC 5545 §3.8.5.3: a start written in UTC repeats at fixed instants, as every other client reads such an entry.
	it('repeats an entry without a zone at fixed instants across a DST change, one with a zone at its wall clock', () => {
		const window = new DateTimeRange(at('2026-10-19T00:00:00Z'), at('2026-10-31T00:00:00Z'))
		const gym = (timeZone?: EntryTimeZone) => new Entry({
			id: 'gym', sourceId: 's', type: EntryType.Event, heading: 'Gym', timeZone,
			start: at('2026-10-23T06:00:00Z'), end: at('2026-10-23T07:00:00Z'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }),
		})
		const starts = (entry: Entry) => entry.occurrences.within(window).map(occurrence => occurrence.start?.toISOString())
		// Berlin leaves DST on Oct 25: 08:00 becomes 07:00 without a zone, and stays 08:00 in Berlin's.
		assert.deepEqual(starts(gym()), ['2026-10-23T06:00:00.000Z', '2026-10-30T06:00:00.000Z'])
		assert.deepEqual(starts(gym(EntryTimeZone.parse('Europe/Berlin'))), ['2026-10-23T06:00:00.000Z', '2026-10-30T07:00:00.000Z'])
	})

	it('yields an override in place of the date it takes over', () => {
		const standup = weekly()
		const moved = Object.assign(standup.occurrences.at(at('2026-10-26T09:00:00Z')).override(), { start: at('2026-10-26T15:00:00Z'), end: at('2026-10-26T15:15:00Z') })
		const occurrences = standup.occurrences.within(new DateTimeRange(at('2026-10-19T00:00:00Z'), at('2026-10-27T00:00:00Z')), [moved])
		assert.deepEqual(occurrences.map(occurrence => [occurrence.entry === moved, occurrence.start?.toISOString(), occurrence.key]), [
			[false, '2026-10-19T09:00:00.000Z', `standup__${Date.parse('2026-10-19T09:00:00Z')}`],
			[true, '2026-10-26T15:00:00.000Z', `standup__${Date.parse('2026-10-26T09:00:00Z')}`],
		])
	})
})

describe('a repeating task with a due', () => {
	const rent = () => new Entry({
		id: 'rent', sourceId: 's', type: EntryType.Task, heading: 'Pay the rent', allDay: true,
		due: D('2026-01-01T00:00:00Z'), estimate: 15, recurrence: new Recurrence({ freq: RecurrenceFrequency.Monthly, bymonthday: 1 }),
	})

	it('repeats its due when it has no start', () => {
		const next = rent().occurrences.within(new DateTimeRange(new Date('2026-03-15T00:00:00Z'), new Date('2026-05-15T00:00:00Z')))
		assert.deepEqual(next.map(occurrence => occurrence.due?.toISOString()), ['2026-04-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'])
	})

	it('is current until the end of its due day where the viewer is', () => {
		// 1 Apr at 08:00 in Auckland is still 31 Mar in Honolulu.
		const now = new Date('2026-03-31T19:00:00Z')
		assert.equal(rent().occurrences.current('Pacific/Auckland', now)?.due?.toISOString(), '2026-04-01T00:00:00.000Z')
		assert.equal(rent().occurrences.current('Pacific/Honolulu', now)?.due?.toISOString(), '2026-04-01T00:00:00.000Z')
		assert.equal(rent().occurrences.current('Pacific/Auckland', new Date('2026-04-01T12:00:00Z'))?.due?.toISOString(), '2026-05-01T00:00:00.000Z')
		assert.equal(rent().occurrences.current('Pacific/Honolulu', new Date('2026-04-01T12:00:00Z'))?.due?.toISOString(), '2026-04-01T00:00:00.000Z')
	})

	it('yields unscheduled occurrences, each owed on its own day', () => {
		const occurrence = rent().occurrences.at(new Date('2026-04-01T00:00:00Z')).override()
		assert.equal(occurrence.start, undefined)
		assert.equal(occurrence.end, undefined)
		assert.equal(occurrence.due?.valueOf(), Date.parse('2026-04-01T00:00:00Z'))
		assert.equal(occurrence.estimate, 15)
		assert.equal(occurrence.recurrenceId?.valueOf(), Date.parse('2026-04-01T00:00:00Z'))
	})

	it('lists where its series sits in the manual order', () => {
		const series = rent()
		series.rank = EntryRank.parse('a3')
		assert.equal(series.occurrences.at(new Date('2026-04-01T00:00:00Z')).override().rank?.key, 'a3')
	})

	it('keeps the due at its offset from a scheduled occurrence', () => {
		const timesheet = new Entry({
			id: 'sheet', sourceId: 's', type: EntryType.Task, heading: 'Timesheet',
			start: D('2026-06-05T13:00:00Z'), end: D('2026-06-05T13:30:00Z'), due: D('2026-06-05T15:00:00Z'),
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }),
		})
		const [expanded] = timesheet.occurrences.within(new DateTimeRange(new Date('2026-06-12T00:00:00Z'), new Date('2026-06-12T23:59:59Z')))
		assert.equal(expanded!.end?.valueOf(), Date.parse('2026-06-12T13:30:00Z'))
		assert.equal(expanded!.due?.valueOf(), Date.parse('2026-06-12T15:00:00Z'))
	})

	it('repeats a moment as moments', () => {
		const meds = new Entry({
			id: 'meds', sourceId: 's', type: EntryType.Task, heading: 'Morning Meds',
			start: D('2026-06-01T05:30:00Z'), recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }),
		})
		const [expanded] = meds.occurrences.within(new DateTimeRange(new Date('2026-06-03T00:00:00Z'), new Date('2026-06-03T23:59:59Z')))
		assert.equal(expanded!.start?.valueOf(), Date.parse('2026-06-03T05:30:00Z'))
		assert.equal(expanded!.end, undefined)
	})

	it('expands a stored VTODO by its schedule, not by the distance to its due', () => {
		const raw = [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			'BEGIN:VTODO', 'UID:sheet', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Timesheet',
			'DTSTART:20260605T130000Z', 'ESTIMATED-DURATION:PT30M', 'DUE:20260605T150000Z', 'RRULE:FREQ=WEEKLY',
			'END:VTODO', 'END:VCALENDAR',
		].join('\r\n')
		const master = new Entry({
			id: 'sheet', sourceId: 's', type: EntryType.Task, heading: 'Timesheet', data: { raw },
			start: D('2026-06-05T13:00:00Z'), end: D('2026-06-05T13:30:00Z'), due: D('2026-06-05T15:00:00Z'),
			recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }),
		})
		const [occurrence] = master.occurrences.within(new DateTimeRange(new Date('2026-06-12T00:00:00Z'), new Date('2026-06-12T23:59:59Z')))
		assert.equal(occurrence!.end?.toISOString(), '2026-06-12T13:30:00.000Z')
	})
})

describe('EntryOccurrences of a synced entry', () => {
	describe('an .ics recurring entry, read as the sync reads it', () => {
		const calendar = (lines: Array<string>) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...lines, 'END:VCALENDAR'].join('\r\n')
		const vevent = (props: Array<string>) => calendar(['BEGIN:VEVENT', 'UID:e1', 'DTSTAMP:20260101T000000Z', ...props, 'END:VEVENT'])
		const at = (iso: string) => new Date(iso)
		const read = (raw: string) => {
			const components = new ICAL.Component(ICAL.parse(raw)).getAllSubcomponents().filter(component => component.name === 'vevent' || component.name === 'vtodo')
			const entry = new Entry({ id: 'e', sourceId: 's' })
			CalDAV.applyComponent(entry, components.find(component => !component.getFirstProperty('recurrence-id'))!, new CalDAV())
			return entry
		}

		it('expands a daily event in the window, carrying its duration', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z')))
			assert.equal(occ.length, 5)
			assert.equal(occ[0]!.start!.toISOString(), '2026-06-01T09:00:00.000Z')
			assert.equal(occ[0]!.end!.toISOString(), '2026-06-01T09:30:00.000Z')
			assert.equal(occ[4]!.start!.toISOString(), '2026-06-05T09:00:00.000Z')
		})

		it('skips EXDATEs', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY', 'EXDATE:20260602T090000Z'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z')))
			assert.equal(occ.length, 4)
			assert.ok(!occ.some(o => o.start!.toISOString() === '2026-06-02T09:00:00.000Z'))
		})

		it('returns only the in-window occurrences of a long-running series', () => {
			const raw = vevent(['DTSTART:20200101T090000Z', 'DTEND:20200101T100000Z', 'RRULE:FREQ=DAILY'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z')))
			assert.equal(occ.length, 3)
			assert.equal(occ[0]!.start!.toISOString(), '2026-06-01T09:00:00.000Z')
		})

		it('respects COUNT: no occurrences after the series ends', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY;COUNT=3'])
			assert.equal(read(raw).occurrences.within(new DateTimeRange(at('2026-06-10T00:00:00Z'), at('2026-06-20T00:00:00Z'))).length, 0)
			assert.equal(read(raw).occurrences.within(new DateTimeRange(at('2026-06-01T00:00:00Z'), at('2026-06-30T00:00:00Z'))).length, 3)
		})

		it('expands a recurring VTODO, anchored on DTSTART with the DUE duration', () => {
			const raw = calendar(['BEGIN:VTODO', 'UID:t1', 'DTSTAMP:20260101T000000Z', 'DTSTART:20260601T090000Z', 'DUE:20260601T100000Z', 'RRULE:FREQ=DAILY', 'END:VTODO'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z')))
			assert.equal(occ.length, 3)
			assert.equal(occ[0]!.end!.getTime() - occ[0]!.start!.getTime(), 60 * 60 * 1000)
		})

		it('expands an all-day (date-only) series with day-long occurrences', () => {
			const raw = vevent(['DTSTART;VALUE=DATE:20260601', 'DTEND;VALUE=DATE:20260602', 'RRULE:FREQ=WEEKLY'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2026-06-01T12:00:00Z'), at('2026-06-21T12:00:00Z')))
			assert.ok(occ.length >= 2)
			assert.equal(occ[0]!.end!.getTime() - occ[0]!.start!.getTime(), 24 * 60 * 60 * 1000)
		})

		it('reaches a far-future window for an unbounded dense series (iteration budget)', () => {
			// ~30 years of daily occurrences (>10k iterations) must still resolve in the future window.
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2056-06-01T00:00:00Z'), at('2056-06-03T23:59:59Z')))
			assert.equal(occ.length, 3)
		})

		it('yields a one-off component once', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z'])
			assert.equal(read(raw).occurrences.recurring, false)
		})

		it('expands off the MASTER even when a bundled override precedes it in document order', () => {
			// A resource bundles the master with its RECURRENCE-ID overrides in no guaranteed order:
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
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z')))
			assert.deepEqual(occ.map(o => o.start!.toISOString()), [
				'2026-06-01T09:00:00.000Z',
				'2026-06-02T09:00:00.000Z', // the rule instance, the override row replaces it at render time
				'2026-06-04T09:00:00.000Z', // Jun 3 is EXDATE'd on the master
				'2026-06-05T09:00:00.000Z',
			])
		})

		it('excludes a DATE exdate of an all-day series at its UTC midnight, where its occurrences are', () => {
			const raw = vevent(['DTSTART;VALUE=DATE:20260601', 'DTEND;VALUE=DATE:20260602', 'RRULE:FREQ=DAILY', 'EXDATE;VALUE=DATE:20260608'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2026-06-07T12:00:00Z'), at('2026-06-09T12:00:00Z')))
			assert.deepEqual(occ.map(o => o.start!.toISOString()), ['2026-06-07T00:00:00.000Z', '2026-06-09T00:00:00.000Z'])
		})

		it('keeps the parts of a rule Mitra doesn\'t edit: the last weekday of each month', () => {
			const raw = vevent(['DTSTART:20260630T090000Z', 'DTEND:20260630T093000Z', 'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1'])
			const entry = read(raw)
			assert.equal(entry.recurrence?.rest, 'BYSETPOS=-1')
			assert.equal(entry.recurrence?.toRRule(), 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1')
			const occ = entry.occurrences.within(new DateTimeRange(at('2026-07-01T00:00:00Z'), at('2026-10-01T00:00:00Z')))
			assert.deepEqual(occ.map(o => o.start!.toISOString().slice(0, 10)), ['2026-07-31', '2026-08-31', '2026-09-30'])
		})

		it('keeps the month of a yearly rule: the second Sunday of May', () => {
			const raw = vevent(['DTSTART;VALUE=DATE:20260510', 'DTEND;VALUE=DATE:20260511', 'RRULE:FREQ=YEARLY;BYMONTH=5;BYDAY=2SU'])
			const occ = read(raw).occurrences.within(new DateTimeRange(at('2027-01-01T00:00:00Z'), at('2028-12-31T00:00:00Z')))
			assert.deepEqual(occ.map(o => o.start!.toISOString().slice(0, 10)), ['2027-05-09', '2028-05-14'])
		})
	})
})
