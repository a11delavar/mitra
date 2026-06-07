import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from './CalDAV.js'

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

	describe('expandRecurrence', () => {
		const calendar = (lines: Array<string>) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...lines, 'END:VCALENDAR'].join('\r\n')
		const vevent = (props: Array<string>) => calendar(['BEGIN:VEVENT', 'UID:e1', 'DTSTAMP:20260101T000000Z', ...props, 'END:VEVENT'])
		const at = (iso: string) => new Date(iso)

		it('expands a daily event in the window, carrying its duration', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY'])
			const occ = CalDAV.expandRecurrence(raw, at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z'))
			assert.equal(occ.length, 5)
			assert.equal(occ[0]!.start.toISOString(), '2026-06-01T09:00:00.000Z')
			assert.equal(occ[0]!.end.toISOString(), '2026-06-01T09:30:00.000Z')
			assert.equal(occ[4]!.start.toISOString(), '2026-06-05T09:00:00.000Z')
		})

		it('skips EXDATEs', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY', 'EXDATE:20260602T090000Z'])
			const occ = CalDAV.expandRecurrence(raw, at('2026-06-01T00:00:00Z'), at('2026-06-05T23:59:59Z'))
			assert.equal(occ.length, 4)
			assert.ok(!occ.some(o => o.start.toISOString() === '2026-06-02T09:00:00.000Z'))
		})

		it('returns only the in-window occurrences of a long-running series', () => {
			const raw = vevent(['DTSTART:20200101T090000Z', 'DTEND:20200101T100000Z', 'RRULE:FREQ=DAILY'])
			const occ = CalDAV.expandRecurrence(raw, at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z'))
			assert.equal(occ.length, 3)
			assert.equal(occ[0]!.start.toISOString(), '2026-06-01T09:00:00.000Z')
		})

		it('respects COUNT — no occurrences after the series ends', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY;COUNT=3'])
			assert.equal(CalDAV.expandRecurrence(raw, at('2026-06-10T00:00:00Z'), at('2026-06-20T00:00:00Z')).length, 0)
			assert.equal(CalDAV.expandRecurrence(raw, at('2026-06-01T00:00:00Z'), at('2026-06-30T00:00:00Z')).length, 3)
		})

		it('expands a recurring VTODO, anchored on DTSTART with the DUE duration', () => {
			const raw = calendar(['BEGIN:VTODO', 'UID:t1', 'DTSTAMP:20260101T000000Z', 'DTSTART:20260601T090000Z', 'DUE:20260601T100000Z', 'RRULE:FREQ=DAILY', 'END:VTODO'])
			const occ = CalDAV.expandRecurrence(raw, at('2026-06-01T00:00:00Z'), at('2026-06-03T23:59:59Z'))
			assert.equal(occ.length, 3)
			assert.equal(occ[0]!.end.getTime() - occ[0]!.start.getTime(), 60 * 60 * 1000)
		})

		it('expands an all-day (date-only) series with day-long occurrences', () => {
			const raw = vevent(['DTSTART;VALUE=DATE:20260601', 'DTEND;VALUE=DATE:20260602', 'RRULE:FREQ=WEEKLY'])
			const occ = CalDAV.expandRecurrence(raw, at('2026-06-01T12:00:00Z'), at('2026-06-21T12:00:00Z'))
			assert.ok(occ.length >= 2)
			assert.equal(occ[0]!.end.getTime() - occ[0]!.start.getTime(), 24 * 60 * 60 * 1000)
		})

		it('reaches a far-future window for an unbounded dense series (iteration budget)', () => {
			// ~30 years of daily occurrences (>10k iterations) must still resolve in the future window.
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z', 'RRULE:FREQ=DAILY'])
			const occ = CalDAV.expandRecurrence(raw, at('2056-06-01T00:00:00Z'), at('2056-06-03T23:59:59Z'))
			assert.equal(occ.length, 3)
		})

		it('returns nothing for a non-recurring component', () => {
			const raw = vevent(['DTSTART:20260601T090000Z', 'DTEND:20260601T093000Z'])
			assert.equal(CalDAV.expandRecurrence(raw, at('2026-06-01T00:00:00Z'), at('2026-06-30T00:00:00Z')).length, 0)
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
