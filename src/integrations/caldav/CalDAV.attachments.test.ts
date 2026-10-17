import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { deconstruct } from '@a11d/converter'
import { DateTime } from '@3mo/date-time'
import { CalDAV } from './CalDAV.js'
import { GoogleCalendar } from '../google/GoogleCalendar.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { Source } from '../../features/sources/Source.js'
import { EntryFile } from '../../features/entries/EntryFile.js'
import { EntryFiles } from '../../features/entries/EntryFiles.js'
import '../server/registerEngines.js'

const id = 'AAAAAAAAAAAAAAAAAAAAAA'

/** ical.js folds long lines at 75 octets (RFC 5545 §3.1); assertions read the unfolded text. */
const unfolded = (component: ICAL.Component) => component.toString().replace(/\r\n[ \t]/g, '')

const componentOf = (...lines: Array<string>) => new ICAL.Component(ICAL.parse([
	'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
	'BEGIN:VEVENT', 'UID:event-1', 'SUMMARY:Kickoff', ...lines, 'END:VEVENT',
	'END:VCALENDAR',
].join('\r\n'))).getFirstSubcomponent('vevent')!

describe('CalDAV ATTACH round-trip', () => {
	const nextcloudLine = 'ATTACH;FMTTYPE=application/pdf;FILENAME=deck.pdf;X-NC-FILE-ID=42;X-NC-HAS-PREVIEW=true:https://cloud.example.com/f/42'

	it('reads the RFC 8607 parameters off a URI line', () => {
		const attachments = CalDAV.attachmentsFrom(componentOf(
			'ATTACH;FMTTYPE=image/png;FILENAME=board.png;SIZE=2048:https://example.com/board.png',
		))
		assert.deepEqual(JSON.parse(JSON.stringify(attachments?.all.map(file => deconstruct(file)))).map(({ id: _, ...facts }: { id: string }) => facts), [{
			sourceUrl: 'https://example.com/board.png',
			name: 'board.png',
			mimeType: 'image/png',
			size: 2048,
			type: 'attachment',
		}])
	})

	it('keeps one of our own URLs as the link it is, which the entry\'s row of that id answers to whatever host the line was written with', () => {
		const url = `https://old-host.example/api/files/${id}/report.pdf`
		const attachments = CalDAV.attachmentsFrom(componentOf(`ATTACH;FMTTYPE=application/pdf;FILENAME=report.pdf:${url}`))
		assert.equal(attachments?.all[0]?.sourceUrl, url)
		assert.equal(attachments!.all[0]!.refersTo(new EntryFile({ id, sha256: 'a'.repeat(64) })), true)
	})

	it('reads a line naming one of the entry\'s own files as that file, so a sync keeps its row and its bytes', () => {
		const held = new EntryFile({ id, userId: 'owner', sha256: 'a'.repeat(64), name: 'report.pdf' })
		const entry = new Entry({ id: 'e', sourceId: 's', type: EntryType.Event, attachments: EntryFiles.of([held]) })
		CalDAV.applyComponent(entry, componentOf('DTSTART:20260602T090000Z', `ATTACH;FMTTYPE=application/pdf;FILENAME=report.pdf:https://old-host.example/api/files/${id}/report.pdf`), new CalDAV({ credentials: { username: 'u', password: 'p' } }))
		const [file] = entry.attachments.all
		assert.equal(file!.id, id)
		assert.equal(file!.sha256, 'a'.repeat(64))
		assert.equal(file!.userId, 'owner')
		assert.equal(file!.sourceUrl, undefined)
	})

	it('does not surface an inline BINARY attachment — nothing here can show one', () => {
		const attachments = CalDAV.attachmentsFrom(componentOf(
			'ATTACH;ENCODING=BASE64;VALUE=BINARY;FMTTYPE=text/plain:aGVsbG8=',
			'ATTACH:https://example.com/x.pdf',
		))
		assert.deepEqual(attachments?.all.map(file => file.sourceUrl), ['https://example.com/x.pdf'])
	})

	it('writes an unchanged list back as it was, every line verbatim', () => {
		const subject = componentOf(nextcloudLine, 'ATTACH:https://example.com/plain.txt')
		const parsed = CalDAV.attachmentsFrom(subject)

		CalDAV.writeAttachments(subject, parsed)
		assert.equal(parsed?.equals(CalDAV.attachmentsFrom(subject)), true)
		const serialized = unfolded(subject)
		assert.match(serialized, /X-NC-FILE-ID=42/)
		assert.match(serialized, /X-NC-HAS-PREVIEW=true/)
		assert.match(serialized, /ATTACH:https:\/\/example.com\/plain.txt/)
	})

	it('adding one attachment keeps the foreign parameters on the lines it did not touch', () => {
		const subject = componentOf(nextcloudLine)
		const parsed = CalDAV.attachmentsFrom(subject)!

		CalDAV.writeAttachments(subject, parsed.adding(EntryFile.from({ sourceUrl: 'https://example.com/new.pdf', name: 'new.pdf', mimeType: 'application/pdf' })!))
		const serialized = unfolded(subject)
		assert.match(serialized, /X-NC-FILE-ID=42/)
		assert.match(serialized, /ATTACH;FMTTYPE=application\/pdf;FILENAME=new.pdf:https:\/\/example.com\/new.pdf/)
	})

	it('never removes an inline BINARY line, even when clearing every attachment', () => {
		const subject = componentOf(
			'ATTACH;ENCODING=BASE64;VALUE=BINARY;FMTTYPE=text/plain:aGVsbG8=',
			'ATTACH:https://example.com/x.pdf',
		)

		CalDAV.writeAttachments(subject, undefined)
		const serialized = unfolded(subject)
		assert.match(serialized, /ENCODING=BASE64/)
		assert.doesNotMatch(serialized, /x\.pdf/)
	})

	it('writes a file Mitra stores as an absolute URL, as the readers of the line are other clients', () => {
		const subject = componentOf()

		CalDAV.writeAttachments(subject, EntryFiles.of([{ id, name: 'report.pdf', mimeType: 'application/pdf', size: 10 }]), 'https://mitra.example.com')
		assert.match(unfolded(subject), new RegExp(`ATTACH;FMTTYPE=application/pdf;FILENAME=report.pdf;SIZE=10:https://mitra.example.com/api/files/${id}/report.pdf`))
	})

	it('removing one attachment deletes only its line', () => {
		const subject = componentOf(nextcloudLine, 'ATTACH:https://example.com/plain.txt')
		const parsed = CalDAV.attachmentsFrom(subject)!

		CalDAV.writeAttachments(subject, parsed.without(EntryFile.from({ sourceUrl: 'https://example.com/plain.txt' })!))
		const serialized = unfolded(subject)
		assert.doesNotMatch(serialized, /plain\.txt/)
		assert.match(serialized, /X-NC-FILE-ID=42/)
	})
})

describe('CalDAV attachments: who holds them (ownership)', () => {
	const raw = [
		'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
		'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Kickoff',
		'DTSTART:20260602T090000Z', 'DTEND:20260602T100000Z',
		'ATTACH;FMTTYPE=application/pdf;FILENAME=deck.pdf:https://example.com/deck.pdf',
		'END:VEVENT', 'END:VCALENDAR',
	].join('\r\n')

	/** The line Google's CalDAV writes for a Drive attachment: `FILENAME` first, an `open?id=` link, no `SIZE`. */
	const drive = raw.replace(/ATTACH[^\r]*/, 'ATTACH;FILENAME=Report.pdf;FMTTYPE=application/pdf:https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456')

	const source = () => new Source({ id: 'src1', integrationId: 'i1', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event], name: 'Cal' })

	const sync = async (integration: CalDAV, data = raw) => {
		const src = source()
		;(integration as unknown as { client: unknown }).client = Promise.resolve({
			syncCollection: () => Promise.resolve([{ href: '/cal/a.ics', status: 200, raw: { multistatus: { syncToken: 't1' } } }]),
			fetchCalendarObjects: () => Promise.resolve([{ url: 'https://example.com/cal/a.ics', etag: 'e1', data }]),
		})
		const persisted = new Array<unknown>()
		const em = {
			find: (Type: unknown) => Promise.resolve(Type === Source ? [src] : []),
			findOne: () => Promise.resolve(null),
			persist(row: unknown) { persisted.push(row) },
			remove() { },
		}
		await (integration as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> }).syncSourceEntries(em, src)
		return persisted.find((row): row is Entry => row instanceof Entry)!
	}

	it('reads them on a real iCalendar store', async () => {
		const entry = await sync(new CalDAV({ credentials: { username: 'u', password: 'p' } }))
		assert.deepEqual(entry.attachments?.all.map(file => file.sourceUrl), ['https://example.com/deck.pdf'])
	})

	it('reads a Drive file on Google, in the line Google writes for one', async () => {
		const entry = await sync(new GoogleCalendar({ credentials: { username: 'someone@gmail.com', refreshToken: 'grant-1' } }), drive)
		assert.deepEqual(entry.attachments.all.map(file => [file.sourceUrl, file.name, file.mimeType?.toString()]), [
			['https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456', 'Report.pdf', 'application/pdf'],
		])
		assert.equal(entry.heading, 'Kickoff')
	})

	describe('writes', () => {
		const existing = () => new Entry({
			id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Kickoff', uri: 'https://example.com/cal/a.ics',
			start: new DateTime('2026-06-02T09:00:00Z'), end: new DateTime('2026-06-02T10:00:00Z'),
			data: { raw },
			attachments: EntryFiles.of([{ sourceUrl: 'https://example.com/deck.pdf', name: 'deck.pdf', mimeType: 'application/pdf' }]),
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
			incoming.attachments = incoming.attachments!.adding(EntryFile.from({ sourceUrl: 'https://example.com/agenda.md', name: 'agenda.md' })!)
			await dav.updateEntry(em(), entry, incoming)
			assert.match(entry.data!.raw!, /agenda\.md/)
			assert.match(entry.data!.raw!, /deck\.pdf/)
		})

		it('sends NOTHING to Google for an attachments-only edit: Google would drop the line and the next read would clear the file', async () => {
			const integration = new GoogleCalendar({ credentials: { username: 'someone@gmail.com', refreshToken: 'grant-1' } })
			const writes = stub(integration)
			const entry = existing()
			const incoming = entry.clone()
			incoming.attachments = EntryFiles.of([{ sourceUrl: 'https://example.com/agenda.md' }])
			await integration.updateEntry(em(), entry, incoming)
			assert.equal(writes.length, 0)
			assert.doesNotMatch(entry.data!.raw!, /agenda\.md/)
		})

		it('an unrelated edit on Google leaves the Drive line as Google wrote it', async () => {
			const integration = new GoogleCalendar({ credentials: { username: 'someone@gmail.com', refreshToken: 'grant-1' } })
			stub(integration)
			const entry = existing()
			entry.data = { raw: drive }
			entry.attachments = EntryFiles.of([{ sourceUrl: 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456', name: 'Report.pdf', mimeType: 'application/pdf' }])
			const incoming = entry.clone()
			incoming.heading = 'Renamed'
			await integration.updateEntry(em(), entry, incoming)
			assert.match(entry.data!.raw!.replace(/\r\n[ \t]/g, ''), /ATTACH;FILENAME=Report\.pdf;FMTTYPE=application\/pdf:https:\/\/drive\.google\.com\/open\?id=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456/)
			assert.match(entry.data!.raw!, /Renamed/)
		})

		it('an unrelated edit does not disturb the attachment lines', async () => {
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			stub(dav)
			const entry = existing()
			const incoming = entry.clone()
			incoming.heading = 'Renamed'
			await dav.updateEntry(em(), entry, incoming)
			assert.match(entry.data!.raw!.replace(/\r\n[ \t]/g, ''), /ATTACH;FMTTYPE=application\/pdf;FILENAME=deck.pdf:https:\/\/example.com\/deck.pdf/)
		})
	})
})
