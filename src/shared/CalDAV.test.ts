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
