import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CalDAV } from '../CalDAV.js'
import '../../server/registerEngines.js'
import { Entry } from '../../../features/entries/Entry.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { Source } from '../../../features/sources/Source.js'

const COLLECTION = 'https://example.com/cal/'

type Listing = {
	readonly members: ReadonlyArray<{ href: string, status?: number }>
	readonly token?: string
	readonly truncated?: boolean
	readonly failure?: number
}

const ics = (uid: string, summary: string) => [
	'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', 'BEGIN:VEVENT', `UID:${uid}`,
	`SUMMARY:${summary}`, 'DTSTAMP:20260101T000000Z', 'DTSTART:20260706T090000Z', 'DTEND:20260706T100000Z',
	'END:VEVENT', 'END:VCALENDAR',
].join('\r\n')

function fakeServer(listings: ReadonlyArray<Listing>) {
	const tokensSent = new Array<string | undefined>()
	const multigets = new Array<Array<string>>()
	let answered = 0
	const client = {
		syncCollection: ({ syncToken }: { syncToken?: string }) => {
			tokensSent.push(syncToken)
			const listing = listings[Math.min(answered++, listings.length - 1)]!
			const raw = { multistatus: { syncToken: listing.token } }
			if (listing.failure) {
				return Promise.resolve([{ href: COLLECTION, status: listing.failure, statusText: 'Nope', ok: false, raw: 'an error page' }])
			}
			return Promise.resolve([
				...listing.truncated
					? [{ href: COLLECTION, status: 507, ok: false, error: { numberOfMatchesWithinLimits: {} }, raw }]
					: [{ href: COLLECTION, status: 200, ok: true, raw }],
				...listing.members.map(member => ({ href: member.href, status: member.status ?? 200, ok: (member.status ?? 200) < 300, raw })),
			])
		},
		fetchCalendarObjects: ({ objectUrls }: { objectUrls: Array<string> }) => {
			multigets.push([...objectUrls])
			return Promise.resolve(objectUrls.map(url => ({ url, etag: `etag-${url}`, data: ics(url, url.split('/').pop()!.replace('.ics', '')) })))
		},
	}
	const integration = new CalDAV({ credentials: { username: 'u', password: 'p' } })
	;(integration as unknown as { client: unknown }).client = Promise.resolve(client)
	return {
		tokensSent,
		multigets,
		integration,
		get reports() { return tokensSent.length },
		get fetched() { return multigets.flat() },
	}
}

function fakeEntityManager(entries: ReadonlyArray<Entry>) {
	return {
		persisted: new Array<Entry>(),
		removed: new Array<Entry>(),
		find: (entity: unknown) => Promise.resolve(entity === Entry ? [...entries] : []),
		findOne: () => Promise.resolve(null),
		persist(entity: unknown) {
			if (entity instanceof Entry) {
				this.persisted.push(entity)
			}
		},
		remove(entity: unknown) {
			if (entity instanceof Entry) {
				this.removed.push(entity)
			}
		},
	}
}

const localEntry = (name: string) => new Entry({
	id: crypto.randomUUID(),
	sourceId: 'src1',
	uri: `${COLLECTION}${name}.ics`,
	heading: name,
	type: EntryType.Event,
})

async function sync(listings: ReadonlyArray<Listing>, existing: ReadonlyArray<Entry> = [], syncToken?: string) {
	const source = new Source({
		id: 'src1', integrationId: 'i1', uri: COLLECTION, name: 'Work',
		entryTypes: [EntryType.Event, EntryType.Task], enabled: true,
		syncState: syncToken ? { syncToken } : undefined,
	})
	const server = fakeServer(listings)
	const em = fakeEntityManager(existing)
	const changed = await (server.integration as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> })
		.syncSourceEntries(em, source)
	return { ...server, em, source, changed }
}

describe('CalDAV sync follows a truncated listing to its end (RFC 6578)', () => {
	const chunked: ReadonlyArray<Listing> = [
		{ members: [{ href: '/cal/a.ics' }, { href: '/cal/b.ics' }], token: 'token-1', truncated: true },
		{ members: [{ href: '/cal/c.ics' }, { href: '/cal/d.ics' }], token: 'token-2', truncated: true },
		{ members: [{ href: '/cal/e.ics' }], token: 'token-3' },
	]

	it('repeats the REPORT with each advanced token until the listing is complete', async () => {
		const { reports, tokensSent } = await sync(chunked)
		assert.equal(reports, 3)
		assert.deepEqual(tokensSent, [undefined, 'token-1', 'token-2'])
	})

	it('imports every chunk in ONE pass, not one chunk per sync cycle', async () => {
		const { em, changed } = await sync(chunked)
		assert.equal(changed, true)
		assert.deepEqual(em.persisted.map(entry => entry.heading), ['a', 'b', 'c', 'd', 'e'])
	})

	it('stores the LAST token, so the next cycle asks for a real delta', async () => {
		const { source } = await sync(chunked)
		assert.deepEqual(source.syncState, { syncToken: 'token-3' })
	})

	it('walks an untruncated listing with exactly one REPORT', async () => {
		const { reports, em } = await sync([{ members: [{ href: '/cal/a.ics' }], token: 'token-1' }])
		assert.equal(reports, 1)
		assert.deepEqual(em.persisted.map(entry => entry.heading), ['a'])
	})

	it('follows the truncation of an incremental delta too, not just a first import', async () => {
		const { reports, em, source } = await sync(chunked, [], 'token-0')
		assert.equal(reports, 3)
		assert.deepEqual(em.persisted.map(entry => entry.heading), ['a', 'b', 'c', 'd', 'e'])
		assert.deepEqual(source.syncState, { syncToken: 'token-3' })
	})

	it('fetches each member once, even if a later chunk re-lists it', async () => {
		const { fetched } = await sync([
			{ members: [{ href: '/cal/a.ics' }], token: 'token-1', truncated: true },
			{ members: [{ href: '/cal/a.ics' }, { href: '/cal/b.ics' }], token: 'token-2' },
		])
		assert.deepEqual(fetched, [`${COLLECTION}a.ics`, `${COLLECTION}b.ics`])
	})

	it('lets a later chunk\'s removal override an earlier chunk\'s change', async () => {
		const gone = localEntry('a')
		const { em, fetched } = await sync([
			{ members: [{ href: '/cal/a.ics' }], token: 'token-1', truncated: true },
			{ members: [{ href: '/cal/a.ics', status: 404 }], token: 'token-2' },
		], [gone])
		assert.deepEqual(em.removed, [gone])
		assert.deepEqual(fetched, [])
	})

	it('gives up after a bounded number of REPORTs rather than chasing an endlessly truncating server', async () => {
		const endless = Array.from({ length: 200 }, (_, index) => ({ members: [{ href: `/cal/${index}.ics` }], token: `token-${index}`, truncated: true }))
		const { reports, source } = await sync(endless)
		assert.equal(reports, 50)
		assert.deepEqual(source.syncState, { syncToken: 'token-49', incomplete: true })
	})

	it('stops instead of spinning when a truncated answer repeats the token it was given', async () => {
		const { reports } = await sync([
			{ members: [{ href: '/cal/a.ics' }], token: 'token-1', truncated: true },
			{ members: [{ href: '/cal/b.ics' }], token: 'token-1', truncated: true },
		])
		assert.equal(reports, 2)
	})

	it('stops instead of spinning when a truncated answer carries no token at all', async () => {
		const { reports, source } = await sync([{ members: [{ href: '/cal/a.ics' }], truncated: true }], [], 'token-0')
		assert.equal(reports, 1)
		assert.deepEqual(source.syncState, { syncToken: 'token-0', incomplete: true })
	})
})

describe('CalDAV sync only reads absence as deletion off a listing it knows is complete', () => {
	it('keeps the entries a truncated first listing has not got to yet', async () => {
		const [kept, alsoKept] = [localEntry('kept'), localEntry('also-kept')]
		const { em } = await sync(
			[{ members: [{ href: '/cal/kept.ics' }], token: 'token-1', truncated: true }],
			[kept, alsoKept],
		)
		assert.deepEqual(em.removed, [])
	})

	it('does remove them once the walk reaches the end of the listing', async () => {
		const [kept, gone] = [localEntry('kept'), localEntry('gone')]
		const { em } = await sync([
			{ members: [{ href: '/cal/kept.ics' }], token: 'token-1', truncated: true },
			{ members: [{ href: '/cal/still-here.ics' }], token: 'token-2' },
		], [kept, gone])
		assert.deepEqual(em.removed, [gone])
	})

	it('still applies the removals the server reported outright, truncated or not', async () => {
		const [gone, untouched] = [localEntry('gone'), localEntry('untouched')]
		const { em } = await sync(
			[{ members: [{ href: '/cal/gone.ics', status: 404 }], token: 'token-1', truncated: true }],
			[gone, untouched],
		)
		assert.deepEqual(em.removed, [gone])
	})

	it('deletes nothing when the REPORT failed outright, and keeps the stored token', async () => {
		const entries = [localEntry('a'), localEntry('b')]
		const { em, source, changed } = await sync([{ members: [], failure: 503 }], entries, 'token-0')
		assert.deepEqual(em.removed, [])
		assert.equal(changed, false)
		// Incomplete, so a failed listing can never be mistaken for a finished import.
		assert.deepEqual(source.syncState, { syncToken: 'token-0', incomplete: true })
	})

	it('deletes nothing when a member the server could not serve (507) is missing from the listing', async () => {
		const [kept, unserved] = [localEntry('kept'), localEntry('unserved')]
		const { em, fetched } = await sync(
			[{ members: [{ href: '/cal/kept.ics' }, { href: '/cal/unserved.ics', status: 507 }], token: 'token-1' }],
			[kept, unserved],
		)
		assert.deepEqual(em.removed, [])
		assert.deepEqual(fetched, [`${COLLECTION}kept.ics`])
	})

	it('mirrors a genuinely emptied collection', async () => {
		const entries = [localEntry('a'), localEntry('b')]
		const { em, changed } = await sync([{ members: [], token: 'token-1' }], entries)
		assert.deepEqual(em.removed, entries)
		assert.equal(changed, true)
	})
})

describe('partitionMemberResponses reads the truncation mark', () => {
	it('reports a listing the server cut short', () => {
		const { changedUrls, truncated } = CalDAV.partitionMemberResponses(COLLECTION, [
			{ href: '/cal/', status: 507, error: { numberOfMatchesWithinLimits: {} } },
			{ href: '/cal/keep.ics', status: 200 },
		])
		assert.equal(truncated, true)
		assert.deepEqual(changedUrls, [`${COLLECTION}keep.ics`])
	})

	it('reports a complete listing as complete', () => {
		const { truncated } = CalDAV.partitionMemberResponses(COLLECTION, [{ href: '/cal/keep.ics', status: 200 }])
		assert.equal(truncated, false)
	})

	it('leaves out a member the server itself could not serve — neither fetchable nor gone', () => {
		const { changedUrls, deletedUrls, truncated } = CalDAV.partitionMemberResponses(COLLECTION, [{ href: '/cal/left-out.ics', status: 507 }])
		assert.deepEqual(changedUrls, [])
		assert.deepEqual(deletedUrls, [])
		assert.equal(truncated, true)
	})
})

describe('CalDAV multiget batching', () => {
	it('splits a collection-sized fetch into batches instead of naming every member in one REPORT', async () => {
		const members = Array.from({ length: 250 }, (_, index) => ({ href: `/cal/${index}.ics` }))
		const { multigets, fetched } = await sync([{ members, token: 'token-1' }])
		assert.deepEqual(multigets.map(batch => batch.length), [100, 100, 50])
		assert.equal(new Set(fetched).size, 250)
	})
})
