import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from './CalDAV.js'
import { Entry, EntryType } from './Entry.js'

type DateTime = import('@3mo/date-time').DateTime
const D = (iso: string) => new Date(iso) as unknown as DateTime

describe('CalDAV member URLs', () => {
	const collection = 'https://example.com/123/calendars/xyz/'

	describe('collectionUrl', () => {
		it('ensures a trailing slash', () => {
			assert.equal(CalDAV.collectionUrl('https://example.com/cal'), 'https://example.com/cal/')
		})

		it('preserves an existing trailing slash', () => {
			assert.equal(CalDAV.collectionUrl('https://example.com/cal/'), 'https://example.com/cal/')
		})
	})

	describe('resolveMemberUrl', () => {
		it('resolves an absolute-path href (as iCloud returns) to a full URL', () => {
			assert.equal(
				CalDAV.resolveMemberUrl(collection, '/123/calendars/xyz/abc.ics'),
				'https://example.com/123/calendars/xyz/abc.ics'
			)
		})

		it('resolves a bare filename against the collection', () => {
			assert.equal(CalDAV.resolveMemberUrl(collection, 'abc.ics'), 'https://example.com/123/calendars/xyz/abc.ics')
		})

		it('returns a full URL unchanged', () => {
			assert.equal(
				CalDAV.resolveMemberUrl(collection, 'https://example.com/123/calendars/xyz/abc.ics'),
				'https://example.com/123/calendars/xyz/abc.ics'
			)
		})

		it('returns an empty string for null/undefined', () => {
			assert.equal(CalDAV.resolveMemberUrl(collection, null), '')
			assert.equal(CalDAV.resolveMemberUrl(collection, undefined), '')
		})
	})

	describe('memberUrlsMatch', () => {
		it('matches a full URL with its absolute-path equivalent', () => {
			assert.equal(
				CalDAV.memberUrlsMatch(collection, 'https://example.com/123/calendars/xyz/abc.ics', '/123/calendars/xyz/abc.ics'),
				true
			)
		})

		it('does not match different members', () => {
			assert.equal(CalDAV.memberUrlsMatch(collection, '/123/calendars/xyz/abc.ics', '/123/calendars/xyz/def.ics'), false)
		})

		it('does not match when either side is missing', () => {
			assert.equal(CalDAV.memberUrlsMatch(collection, null, '/123/calendars/xyz/abc.ics'), false)
		})
	})

	describe('partitionMemberResponses', () => {
		// The iCloud-deletion fix: hrefs come back as absolute paths and must be resolved to full URLs so
		// the changed set is fetchable and the deleted set matches stored full-URL uris.
		it('resolves absolute-path hrefs to full URLs and splits changed vs deleted, excluding the collection', () => {
			const { changedUrls, deletedUrls } = CalDAV.partitionMemberResponses(collection, [
				{ href: '/123/calendars/xyz/', status: 200 },        // the collection itself — excluded
				{ href: '/123/calendars/xyz/keep.ics', status: 200 }, // changed / added
				{ href: '/123/calendars/xyz/gone.ics', status: 404 }, // removed remotely
			])
			assert.deepEqual(changedUrls, ['https://example.com/123/calendars/xyz/keep.ics'])
			assert.deepEqual(deletedUrls, ['https://example.com/123/calendars/xyz/gone.ics'])
		})

		it('excludes the collection despite a trailing-slash difference, and skips hrefless rows', () => {
			const { changedUrls, deletedUrls } = CalDAV.partitionMemberResponses('https://example.com/cal', [
				{ href: '/cal', status: 200 },  // collection itself, no trailing slash — excluded
				{ href: '/cal/', status: 200 }, // collection itself, trailing slash — excluded
				{ status: 200 },                // no href — skipped
				{ href: '/cal/a.ics', status: 404 },
			])
			assert.deepEqual(changedUrls, [])
			assert.deepEqual(deletedUrls, ['https://example.com/cal/a.ics'])
		})
	})
})

describe('CalDAV all-day serialization', () => {
	describe('toICALTime', () => {
		it('writes an all-day DATE as the instant\'s calendar day in the ENTRY\'s zone, not the server\'s', () => {
			// All-day instants are the user's local midnights: Berlin midnight of Jun 2 is Jun 1 in UTC —
			// a UTC container reading its own calendar would write every all-day date one day early.
			const berlin = CalDAV.toICALTime(D('2026-06-01T22:00:00Z'), true, 'Europe/Berlin')
			assert.deepEqual([berlin.year, berlin.month, berlin.day, berlin.isDate], [2026, 6, 2, true])
			// Half-hour zones too: Tehran midnight of Jun 2 = 20:30Z the previous day.
			const tehran = CalDAV.toICALTime(D('2026-06-01T20:30:00Z'), true, 'Asia/Tehran')
			assert.deepEqual([tehran.year, tehran.month, tehran.day, tehran.isDate], [2026, 6, 2, true])
		})

		it('falls back to the runtime\'s local calendar without a zone (the legacy zoneless path)', () => {
			// A locally-constructed midnight reads as its own date in every runtime zone.
			const time = CalDAV.toICALTime(new Date(2026, 5, 2) as unknown as DateTime, true, null)
			assert.deepEqual([time.year, time.month, time.day, time.isDate], [2026, 6, 2, true])
		})

		it('keeps a timed value an absolute UTC instant — the zone is all-day day-boundary semantics only', () => {
			const time = CalDAV.toICALTime(D('2026-06-01T22:00:00Z'), false, 'Europe/Berlin')
			assert.equal(time.isDate, false)
			assert.equal(time.toJSDate().toISOString(), '2026-06-01T22:00:00.000Z')
		})
	})

	describe('through the write paths (stubbed client)', () => {
		const raw = [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z',
			'DTSTART:20260602T090000Z', 'DTEND:20260602T100000Z',
			'END:VEVENT', 'END:VCALENDAR',
		].join('\r\n')

		const stubbed = () => {
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			const client = {
				updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
			}
			;(dav as unknown as { client: unknown }).client = Promise.resolve(client)
			return dav
		}

		it('updateEntry writes VALUE=DATE properties carrying the entry-zone dates, wherever the server runs', async () => {
			const existing = new Entry({
				id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Trip', uri: 'https://example.com/cal/e1.ics',
				start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), allDay: false,
				timeZone: 'Europe/Berlin', data: { raw },
			})
			const incoming = new Entry({
				sourceId: 's', type: EntryType.Event, heading: 'Trip', allDay: true, timeZone: 'Europe/Berlin',
				start: D('2026-06-01T22:00:00Z'), end: D('2026-06-02T22:00:00Z'), // all-day Jun 2, Berlin midnights
				exdates: [new Date('2026-06-07T22:00:00Z').getTime()], // an excluded all-day Jun 8
			})
			await stubbed().updateEntry({} as never, existing, incoming)
			assert.match(existing.data!.raw!, /DTSTART;VALUE=DATE:20260602/)
			assert.match(existing.data!.raw!, /DTEND;VALUE=DATE:20260603/) // the exclusive next day
			assert.match(existing.data!.raw!, /EXDATE;VALUE=DATE:20260608/)
		})

		it('excludeOccurrence writes the occurrence\'s DATE in the master\'s zone', async () => {
			const master = new Entry({
				id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Trip', uri: 'https://example.com/cal/m.ics',
				allDay: true, timeZone: 'Europe/Berlin', data: { raw },
			})
			await stubbed().excludeOccurrence({} as never, master, new Date('2026-06-07T22:00:00Z')) // all-day Jun 8 Berlin
			assert.match(master.data!.raw!, /EXDATE;VALUE=DATE:20260608/)
		})
	})
})
