import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { CalDAV } from './CalDAV.js'
import { GoogleCalendar } from '../google/GoogleCalendar.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { Source } from '../../features/sources/Source.js'
import { EntryRelations } from '../../features/relations/EntryRelations.js'
import { RelationType } from '../../features/relations/RelationType.js'
import '../server/registerEngines.js'

describe('CalDAV relations round-trip', () => {
	const raw = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//test//EN',
		'BEGIN:VTODO',
		'UID:todo-1',
		'SUMMARY:Test',
		'RELATED-TO;RELTYPE=CHILD:child-uid',
		'RELATED-TO:bare-parent-uid',
		'RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT1D:predecessor-uid',
		'RELATED-TO;RELTYPE=X-DUPLICATE-OF:duplicate-uid',
		'END:VTODO',
		'END:VCALENDAR',
	].join('\r\n')

	const component = () => new ICAL.Component(ICAL.parse(raw)).getFirstSubcomponent('vtodo')!

	it('parses every RELTYPE opaquely, defaulting a bare RELATED-TO to PARENT (RFC 5545 §3.2.15)', () => {
		const relations = CalDAV.relationsFrom(component())
		assert.deepEqual(relations?.map(relation => [relation.type, relation.targetUid, relation.gap]), [
			[RelationType.Child, 'child-uid', null],
			[RelationType.FinishToStart, 'predecessor-uid', 'PT1D'],
			[RelationType.Parent, 'bare-parent-uid', null],
			[RelationType.of('X-DUPLICATE-OF'), 'duplicate-uid', null],
		])
	})

	it('write-then-parse is identity — an unchanged list leaves every line VERBATIM (diff, not rewrite)', () => {
		const subject = component()
		const parsed = CalDAV.relationsFrom(subject)

		CalDAV.writeRelations(subject, parsed)
		const reparsed = CalDAV.relationsFrom(subject)
		assert.equal(EntryRelations.of(undefined, parsed).equals(EntryRelations.of(undefined, reparsed)), true)
		const serialized = subject.toString()
		assert.match(serialized, /RELATED-TO;RELTYPE=CHILD:child-uid/)
		assert.match(serialized, /RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT1D:predecessor-uid|RELATED-TO;GAP=PT1D;RELTYPE=FINISHTOSTART:predecessor-uid/)
		assert.match(serialized, /RELATED-TO;RELTYPE=X-DUPLICATE-OF:duplicate-uid/)
		assert.match(serialized, /RELATED-TO:bare-parent-uid/)
	})

	it('an edit that only ADDS a relation keeps foreign parameters the model does not carry', () => {
		const withForeignParams = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-3',
			'SUMMARY:Foreign params',
			'RELATED-TO;RELTYPE=FINISHTOSTART;X-CLIENT-DATA=abc:kept-uid',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		const parsed = CalDAV.relationsFrom(withForeignParams)!
		const edited = EntryRelations.of(undefined, [...parsed, { type: RelationType.Parent, targetUid: 'new-parent' }]).value

		CalDAV.writeRelations(withForeignParams, edited)
		const serialized = withForeignParams.toString()
		assert.match(serialized, /RELATED-TO;RELTYPE=FINISHTOSTART;X-CLIENT-DATA=abc:kept-uid/)
		assert.match(serialized, /RELATED-TO;RELTYPE=PARENT:new-parent/)
	})

	it('removing ONE relation deletes only its line — a same-target sibling stays verbatim', () => {
		const subject = component()
		const parsed = CalDAV.relationsFrom(subject)!
		const remaining = parsed.filter(relation => relation.targetUid !== 'child-uid')

		CalDAV.writeRelations(subject, remaining)
		const serialized = subject.toString()
		assert.doesNotMatch(serialized, /child-uid/)
		assert.match(serialized, /RELATED-TO:bare-parent-uid/)
		assert.match(serialized, /RELATED-TO;RELTYPE=X-DUPLICATE-OF:duplicate-uid/)
		assert.equal(EntryRelations.of(undefined, CalDAV.relationsFrom(subject)).equals(EntryRelations.of(undefined, remaining)), true)
	})

	it('a foreign lowercase reltype normalizes into the same identity, so the diff still matches it', () => {
		const lax = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//test//EN',
			'BEGIN:VEVENT',
			'UID:event-lax',
			'SUMMARY:Lax casing',
			'RELATED-TO;RELTYPE=child:someone',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		const parsed = CalDAV.relationsFrom(lax)!
		assert.equal(parsed[0]!.type, RelationType.Child)

		CalDAV.writeRelations(lax, parsed)
		assert.match(lax.toString(), /RELATED-TO;RELTYPE=child:someone/)
	})

	it('two lines differing only in GAP are distinct relationships and both survive', () => {
		const gapped = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-4',
			'SUMMARY:Gapped',
			'RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT1D:x',
			'RELATED-TO;RELTYPE=FINISHTOSTART;GAP=PT2D:x',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		const parsed = CalDAV.relationsFrom(gapped)
		assert.equal(parsed?.length, 2)

		CalDAV.writeRelations(gapped, parsed)
		assert.equal(CalDAV.relationsFrom(gapped)?.length, 2)
	})

	it('writing null clears every RELATED-TO line', () => {
		const subject = component()

		CalDAV.writeRelations(subject, null)
		assert.equal(CalDAV.relationsFrom(subject), null)
		assert.doesNotMatch(subject.toString(), /RELATED-TO/)
	})

	it('parses no RELATED-TO as the canonical null, and dedupes repeated lines', () => {
		const bare = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-1',
			'SUMMARY:No relations',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		assert.equal(CalDAV.relationsFrom(bare), null)

		const doubled = new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'BEGIN:VEVENT',
			'UID:event-2',
			'SUMMARY:Doubled',
			'RELATED-TO;RELTYPE=PARENT:p',
			'RELATED-TO:p',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!
		assert.equal(CalDAV.relationsFrom(doubled)?.length, 1)
	})
})

describe('CalDAV relations: who is authoritative (capabilities.relations)', () => {
	const withRelation = [
		'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
		'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Kickoff',
		'DTSTART:20260602T090000Z', 'DTEND:20260602T100000Z',
		'RELATED-TO;RELTYPE=FINISHTOSTART:blocker-uid',
		'END:VEVENT', 'END:VCALENDAR',
	].join('\r\n')

	const source = () => new Source({ id: 'src1', integrationId: 'i1', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event], name: 'Cal' })

	const sync = async (integration: CalDAV, raw = withRelation) => {
		const src = source()
		;(integration as unknown as { client: unknown }).client = Promise.resolve({
			syncCollection: () => Promise.resolve([{ href: '/cal/a.ics', status: 200, raw: { multistatus: { syncToken: 't1' } } }]),
			fetchCalendarObjects: () => Promise.resolve([{ url: 'https://example.com/cal/a.ics', etag: 'e1', data: raw }]),
		})
		const persisted = new Array<unknown>()
		const em = {
			find: (Type: unknown) => Promise.resolve(Type === Source ? [src] : []),
			findOne: () => Promise.resolve(null),
			persist(row: unknown) { persisted.push(row) },
			remove() { },
		}
		await (integration as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> }).syncSourceEntries(em, src)
		return { entry: persisted.find((row): row is Entry => row instanceof Entry)!, persisted }
	}

	const google = () => new GoogleCalendar({ credentials: { username: 'someone@gmail.com', refreshToken: 'grant-1' } })

	it('parses a DEFINITE value on a real iCalendar store — what the resource says IS the truth there', async () => {
		const { entry } = await sync(new CalDAV({ credentials: { username: 'u', password: 'p' } }))
		assert.deepEqual(entry.relations?.map(relation => [relation.type.value, relation.targetUid]), [['FINISHTOSTART', 'blocker-uid']])
	})

	it('leaves the value UNDEFINED on Google, so the stored rows are never wiped by a read that lost them', async () => {
		const { entry, persisted } = await sync(google())
		assert.equal(entry.relations, undefined)
		assert.equal(persisted.length, 1)
	})

	it('still ingests everything else from the resource — only the relationship changes hands', async () => {
		const { entry } = await sync(google())
		assert.equal(entry.heading, 'Kickoff')
		assert.equal(entry.uid, 'u1')
	})

	describe('writes', () => {
		const existing = () => new Entry({
			id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Kickoff', uri: 'https://example.com/cal/a.ics',
			start: new Date('2026-06-02T09:00:00Z') as never, end: new Date('2026-06-02T10:00:00Z') as never,
			data: { raw: withRelation },
		})

		const stub = (integration: CalDAV) => {
			const writes = new Array<unknown>()
			;(integration as unknown as { client: unknown }).client = Promise.resolve({
				updateCalendarObject: (payload: unknown) => { writes.push(payload); return Promise.resolve({ ok: true, headers: { get: () => null } }) },
				createCalendarObject: (payload: unknown) => { writes.push(payload); return Promise.resolve({ ok: true, headers: { get: () => null } }) },
			})
			return writes
		}

		const em = () => ({ find: () => Promise.resolve([]), findOne: () => Promise.resolve(source()), persist() { }, remove() { } }) as never

		it('writes the line on a real store', async () => {
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			stub(dav)
			const entry = existing()
			const incoming = entry.clone()
			incoming.relations = EntryRelations.of(undefined, [{ type: RelationType.Parent, targetUid: 'parent-uid' }]).value
			await dav.updateEntry(em(), entry, incoming)
			assert.match(entry.data!.raw!, /RELATED-TO;RELTYPE=PARENT:parent-uid/)
		})

		it('sends NOTHING to Google for a relations-only edit — a line the next read discards is pure churn', async () => {
			const integration = google()
			const writes = stub(integration)
			const entry = existing()
			const incoming = entry.clone()
			incoming.relations = EntryRelations.of(undefined, [{ type: RelationType.Parent, targetUid: 'parent-uid' }]).value
			await integration.updateEntry(em(), entry, incoming)
			assert.equal(writes.length, 0)
			assert.doesNotMatch(entry.data!.raw!, /parent-uid/)
		})

		it('creates a Google event without a RELATED-TO, keeping the link in mitra alone', async () => {
			const integration = google()
			stub(integration)
			const entry = new Entry({ sourceId: 's', type: EntryType.Event, heading: 'New', start: new Date('2026-06-02T09:00:00Z') as never })
			entry.relations = EntryRelations.of(undefined, [{ type: RelationType.Parent, targetUid: 'parent-uid' }]).value
			await integration.createEntry(em(), entry)
			assert.doesNotMatch(entry.data!.raw!, /RELATED-TO/)
			assert.match(entry.data!.raw!, /SUMMARY:New/)
		})
	})
})
