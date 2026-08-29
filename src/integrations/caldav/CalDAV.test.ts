import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { CalDAV } from './CalDAV.js'
import { CalDAVSyncEngine } from './server/CalDAVSyncEngine.js'
import '../server/registerEngines.js'
import { Entry, TaskStatus, Transparency, Visibility, FLOATING_TIME_ZONE } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { Source } from '../../features/sources/Source.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { ParticipantRole, ParticipantStatus } from '../../features/participants/Participant.js'
import { asBrowser, wireOf } from '../../infrastructure/model/wire.testing.js'

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

	describe('participants (ATTENDEE / ORGANIZER)', () => {
		const vevent = (lines: ReadonlyArray<string>) => new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:x', 'DTSTART:20260101T090000Z',
			...lines,
			'END:VEVENT', 'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent('vevent')!

		it('parses the organizer and attendees with their names, roles and replies', () => {
			const component = vevent([
				'ORGANIZER;CN=Organizer:mailto:Organizer@Example.com',
				'ATTENDEE;CN=Optional Attendee;ROLE=OPT-PARTICIPANT;PARTSTAT=TENTATIVE:mailto:optional@example.com',
				'ATTENDEE:mailto:pending@example.com',
			])
			assert.deepEqual([...CalDAV.participantsFrom(component, ['me@example.com'])!], [
				{ email: 'organizer@example.com', name: 'Organizer', organizer: true, role: ParticipantRole.Required, status: ParticipantStatus.Accepted },
				{ email: 'optional@example.com', name: 'Optional Attendee', role: ParticipantRole.Optional, status: ParticipantStatus.Tentative },
				{ email: 'pending@example.com', role: ParticipantRole.Required, status: ParticipantStatus.NeedsAction },
			])
		})

		it('merges the organizer with its own ATTENDEE — one row whose actual reply wins', () => {
			const component = vevent([
				'ORGANIZER:mailto:me@example.com',
				'ATTENDEE;PARTSTAT=TENTATIVE:mailto:me@example.com',
			])
			assert.deepEqual([...CalDAV.participantsFrom(component, ['me@example.com'])!], [
				{ email: 'me@example.com', organizer: true, role: ParticipantRole.Required, status: ParticipantStatus.Tentative, self: true },
			])
		})

		it('stamps `self` on the account\'s own addresses', () => {
			const component = vevent(['ATTENDEE:mailto:Me@Example.com', 'ATTENDEE:mailto:other@example.com'])
			assert.deepEqual(CalDAV.participantsFrom(component, ['me@example.com'])!.map(participant => !!participant.self), [true, false])
		})

		it('skips rooms and resources — bookable things, not people', () => {
			const component = vevent([
				'ATTENDEE;CUTYPE=ROOM:mailto:room@example.com',
				'ATTENDEE;CUTYPE=RESOURCE:mailto:projector@example.com',
				'ATTENDEE;CUTYPE=INDIVIDUAL:mailto:attendee@example.com',
			])
			assert.deepEqual(CalDAV.participantsFrom(component)!.map(participant => participant.email), ['attendee@example.com'])
		})

		it('is null without any — the canonical no-participants value', () => {
			assert.equal(CalDAV.participantsFrom(vevent([])), null)
		})

		it('round-trips through writeParticipants', () => {
			const component = vevent([])
			const participants = [
				{ email: 'me@example.com', name: 'Own Account', organizer: true, role: ParticipantRole.Required, status: ParticipantStatus.Accepted },
				{ email: 'optional@example.com', role: ParticipantRole.Optional, status: ParticipantStatus.NeedsAction },
			]
			CalDAV.writeParticipants(component, participants)
			assert.deepEqual([...CalDAV.participantsFrom(component, ['me@example.com'])!], [
				{ ...participants[0], self: true },
				participants[1],
			])
			assert.equal(component.getAllProperties('attendee')[1]!.getParameter('rsvp')?.toString().toUpperCase(), 'TRUE')
		})

		it('keeps an existing ORGANIZER property rather than duplicating or rewriting it', () => {
			const component = vevent(['ORGANIZER;CN=Organizer:mailto:organizer@example.com'])
			CalDAV.writeParticipants(component, [
				{ email: 'organizer@example.com', organizer: true },
				{ email: 'invitee@example.com' },
			])
			assert.equal(component.getAllProperties('organizer').length, 1)
			assert.equal(component.getFirstProperty('organizer')?.getParameter('cn')?.toString(), 'Organizer')
		})

		it('clearing the list also retires the ORGANIZER — back to a plain private entry', () => {
			const component = vevent(['ORGANIZER:mailto:me@example.com', 'ATTENDEE:mailto:attendee@example.com'])
			CalDAV.writeParticipants(component, null)
			assert.equal(component.getFirstProperty('organizer'), null)
			assert.equal(component.getAllProperties('attendee').length, 0)
		})

		it('leaves scheduling to the server — no SCHEDULE-AGENT on what we write (RFC 6638 default)', () => {
			const component = vevent([])
			CalDAV.writeParticipants(component, [{ email: 'attendee@example.com' }])
			assert.equal(component.getFirstProperty('attendee')?.getParameter('schedule-agent'), undefined)
		})

		it('round-trips every role and reply status through ROLE / PARTSTAT', () => {
			const roles = [ParticipantRole.Chair, ParticipantRole.Required, ParticipantRole.Optional, ParticipantRole.NonParticipant]
			const statuses = [
				ParticipantStatus.NeedsAction, ParticipantStatus.Accepted,
				ParticipantStatus.Declined, ParticipantStatus.Tentative, ParticipantStatus.Delegated,
			]
			for (const role of roles) {
				for (const status of statuses) {
					const component = vevent([])
					CalDAV.writeParticipants(component, [{ email: 'attendee@example.com', role, status }])
					const [read] = CalDAV.participantsFrom(component)!
					assert.deepEqual({ role: read!.role, status: read!.status }, { role, status })
				}
			}
		})

		it('writes the tokens RFC 5545 names, not our own enum values', () => {
			const component = vevent([])
			CalDAV.writeParticipants(component, [{ email: 'a@example.com', role: ParticipantRole.Optional, status: ParticipantStatus.Declined }])
			const attendee = component.getFirstProperty('attendee')
			assert.equal(attendee?.getParameter('role')?.toString(), 'OPT-PARTICIPANT')
			assert.equal(attendee?.getParameter('partstat')?.toString(), 'DECLINED')
		})
	})

	describe('task status mapping', () => {
		it('reads every VTODO STATUS the spec defines', () => {
			assert.equal(CalDAV.statusFromICal('NEEDS-ACTION', 0), TaskStatus.ToDo)
			assert.equal(CalDAV.statusFromICal('IN-PROCESS', 0), TaskStatus.Doing)
			assert.equal(CalDAV.statusFromICal('COMPLETED', 0), TaskStatus.Done)
			assert.equal(CalDAV.statusFromICal('CANCELLED', 0), TaskStatus.Cancelled)
			assert.equal(CalDAV.statusFromICal('completed', 0), TaskStatus.Done)
		})

		it('falls back to PERCENT-COMPLETE, then to ToDo, when STATUS is missing or unknown', () => {
			assert.equal(CalDAV.statusFromICal(undefined, 0), TaskStatus.ToDo)
			assert.equal(CalDAV.statusFromICal(undefined, 100), TaskStatus.Done)
			assert.equal(CalDAV.statusFromICal('X-SOMETHING-ELSE', 100), TaskStatus.Done)
			assert.equal(CalDAV.statusFromICal('X-SOMETHING-ELSE', 0), TaskStatus.ToDo)
		})
	})

	describe('partitionMemberResponses', () => {
		it('resolves absolute-path hrefs to full URLs and splits changed vs deleted, excluding the collection', () => {
			const { changedUrls, deletedUrls } = CalDAV.partitionMemberResponses(collection, [
				{ href: '/123/calendars/xyz/', status: 200 },
				{ href: '/123/calendars/xyz/keep.ics', status: 200 },
				{ href: '/123/calendars/xyz/gone.ics', status: 404 },
			])
			assert.deepEqual(changedUrls, ['https://example.com/123/calendars/xyz/keep.ics'])
			assert.deepEqual(deletedUrls, ['https://example.com/123/calendars/xyz/gone.ics'])
		})

		it('excludes the collection despite a trailing-slash difference, and skips hrefless rows', () => {
			const { changedUrls, deletedUrls } = CalDAV.partitionMemberResponses('https://example.com/cal', [
				{ href: '/cal', status: 200 },
				{ href: '/cal/', status: 200 },
				{ status: 200 },
				{ href: '/cal/a.ics', status: 404 },
			])
			assert.deepEqual(changedUrls, [])
			assert.deepEqual(deletedUrls, ['https://example.com/cal/a.ics'])
		})
	})
})

describe('CalDAV free/busy and access class (TRANSP / CLASS)', () => {
	const stubbed = () => {
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			createCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
			updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
		})
		return dav
	}

	const em = () => ({
		find: () => Promise.resolve([]),
		findOne: () => Promise.resolve(new Source({ id: 's', integrationId: 'i', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event], name: 'Cal' })),
		persist() { },
		remove() { },
	}) as never

	const resource = (...extra: Array<string>) => [
		'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
		'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z',
		'DTSTART:20260602T090000Z', 'DTEND:20260602T100000Z', 'SUMMARY:Standup',
		...extra, 'END:VEVENT', 'END:VCALENDAR',
	].join('\r\n')

	const event = (raw: string, fields?: Partial<Entry>) => new Entry({
		id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Standup', uri: 'https://example.com/cal/e1.ics',
		start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), allDay: false, data: { raw },
		...fields,
	})

	describe('the mappings', () => {
		it('reads TRANSP case-insensitively and leaves anything else UNSET', () => {
			assert.equal(CalDAV.transparencyFromICal('OPAQUE'), Transparency.Busy)
			assert.equal(CalDAV.transparencyFromICal('TRANSPARENT'), Transparency.Free)
			assert.equal(CalDAV.transparencyFromICal('transparent'), Transparency.Free)
			assert.equal(CalDAV.transparencyFromICal(undefined), null)
			assert.equal(CalDAV.transparencyFromICal('X-WHATEVER'), null)
		})

		it('reads CLASS case-insensitively, with anything else meaning the calendar default', () => {
			assert.equal(CalDAV.visibilityFromICal('PUBLIC'), Visibility.Public)
			assert.equal(CalDAV.visibilityFromICal('PRIVATE'), Visibility.Private)
			assert.equal(CalDAV.visibilityFromICal('confidential'), Visibility.Confidential)
			assert.equal(CalDAV.visibilityFromICal(undefined), null)
			assert.equal(CalDAV.visibilityFromICal('X-MY-OWN-CLASS'), null)
		})
	})

	describe('reading a synced resource', () => {
		const sync = async (raw: string, types: Array<EntryType>) => {
			const source = new Source({ id: 's', integrationId: 'i1', uri: 'https://example.com/cal/', entryTypes: types, name: 'Home' })
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			;(dav as unknown as { client: unknown }).client = Promise.resolve({
				syncCollection: () => Promise.resolve([{ href: '/cal/a.ics', status: 200, raw: { multistatus: { syncToken: 't1' } } }]),
				fetchCalendarObjects: () => Promise.resolve([{ url: 'https://example.com/cal/a.ics', etag: 'e1', data: raw }]),
			})
			const persisted = new Array<Entry>()
			await (dav as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> }).syncSourceEntries({
				find: () => Promise.resolve([]),
				findOne: () => Promise.resolve(null),
				persist(entry: Entry) { persisted.push(entry) },
				remove() { },
			}, source)
			return persisted[0]!
		}

		it('lands an event TRANSP and CLASS on the row', async () => {
			const entry = await sync(resource('TRANSP:TRANSPARENT', 'CLASS:PRIVATE'), [EntryType.Event])
			assert.equal(entry.transparency, Transparency.Free)
			assert.equal(entry.visibility, Visibility.Private)
		})

		it('leaves an event that names neither unset — absence is the OPAQUE / calendar-default reading', async () => {
			const entry = await sync(resource(), [EntryType.Event])
			assert.equal(entry.transparency, null)
			assert.equal(entry.visibility, null)
		})

		it('gives a VTODO its CLASS but no free/busy contribution — RFC 5545 gives VTODO no TRANSP', async () => {
			const raw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VTODO', 'UID:t1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Buy milk',
				'DTSTART:20260602T090000Z', 'DUE:20260602T100000Z', 'STATUS:NEEDS-ACTION',
				'CLASS:CONFIDENTIAL', 'END:VTODO', 'END:VCALENDAR',
			].join('\r\n')
			const entry = await sync(raw, [EntryType.Task])
			assert.equal(entry.type, EntryType.Task)
			assert.equal(entry.visibility, Visibility.Confidential)
			assert.equal(entry.transparency, null)
		})
	})

	describe('writing an edit', () => {
		it('marks an event free, and back to busy explicitly', async () => {
			const existing = event(resource())
			await stubbed().updateEntry(em(), existing, event(resource(), { transparency: Transparency.Free }))
			assert.match(existing.data!.raw!, /TRANSP:TRANSPARENT/)
			assert.equal(existing.transparency, Transparency.Free)

			await stubbed().updateEntry(em(), existing, event(existing.data!.raw!, { transparency: Transparency.Busy }))
			assert.match(existing.data!.raw!, /TRANSP:OPAQUE/)
			assert.doesNotMatch(existing.data!.raw!, /TRANSP:TRANSPARENT/)
		})

		it('sets CLASS, and DROPS the line when the visibility goes back to the calendar default', async () => {
			const existing = event(resource('CLASS:PRIVATE'), { visibility: Visibility.Private })
			await stubbed().updateEntry(em(), existing, event(resource('CLASS:PRIVATE'), { visibility: Visibility.Confidential }))
			assert.match(existing.data!.raw!, /CLASS:CONFIDENTIAL/)

			await stubbed().updateEntry(em(), existing, event(existing.data!.raw!, { visibility: null }))
			assert.doesNotMatch(existing.data!.raw!, /CLASS:/)
			assert.equal(existing.visibility, null)
		})

		it('adds neither line to a resource whose only edit was its heading (diff-write losslessness)', async () => {
			const existing = event(resource())
			await stubbed().updateEntry(em(), existing, event(resource(), { heading: 'Renamed' }))
			assert.match(existing.data!.raw!, /SUMMARY:Renamed/)
			assert.doesNotMatch(existing.data!.raw!, /TRANSP:/)
			assert.doesNotMatch(existing.data!.raw!, /CLASS:/)
		})

		it('leaves a task resource free of TRANSP even when the rows disagree', async () => {
			const raw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VTODO', 'UID:t1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Buy milk',
				'DTSTART:20260602T090000Z', 'DUE:20260602T100000Z', 'END:VTODO', 'END:VCALENDAR',
			].join('\r\n')
			const existing = new Entry({
				id: 't1', sourceId: 's', type: EntryType.Task, heading: 'Buy milk', uri: 'https://example.com/cal/t1.ics',
				start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), data: { raw },
			})
			const incoming = new Entry({ ...existing, heading: 'Buy oat milk' } as Partial<Entry>)
			incoming.transparency = Transparency.Free
			await stubbed().updateEntry(em(), existing, incoming)
			assert.doesNotMatch(existing.data!.raw!, /TRANSP/)
		})

		it('unscheduling a task REMOVES its DTSTART and DUE, and clears the row with them', async () => {
			const raw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VTODO', 'UID:t1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Buy milk',
				'DTSTART:20260602T090000Z', 'DUE:20260602T100000Z', 'END:VTODO', 'END:VCALENDAR',
			].join('\r\n')
			const existing = new Entry({
				id: 't1', sourceId: 's', type: EntryType.Task, heading: 'Buy milk', uri: 'https://example.com/cal/t1.ics',
				start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), data: { raw },
			})
			const incoming = new Entry({ ...existing, start: undefined, end: undefined } as Partial<Entry>)

			await stubbed().updateEntry(em(), existing, incoming)

			assert.doesNotMatch(existing.data!.raw!, /DTSTART/)
			assert.doesNotMatch(existing.data!.raw!, /DUE/)
			assert.match(existing.data!.raw!, /SUMMARY:Buy milk/)
			assert.equal(existing.start, undefined)
			assert.equal(existing.end, undefined)
		})
	})

	describe('creating an entry', () => {
		const created = async (fields: Partial<Entry>) => {
			const entry = new Entry({
				sourceId: 's', type: EntryType.Event, heading: 'Standup',
				start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), ...fields,
			})
			await stubbed().createEntry(em(), entry)
			return entry.data!.raw!
		}

		it('writes neither line for an ordinary busy, default-visibility event', async () => {
			const raw = await created({})
			assert.doesNotMatch(raw, /TRANSP:/)
			assert.doesNotMatch(raw, /CLASS:/)
		})

		it('writes both when the entry actually names them', async () => {
			const raw = await created({ transparency: Transparency.Free, visibility: Visibility.Private })
			assert.match(raw, /TRANSP:TRANSPARENT/)
			assert.match(raw, /CLASS:PRIVATE/)
		})
	})
})


describe('CalDAV all-day serialization', () => {
	describe('toICALTime', () => {
		it('writes an all-day DATE as the canonical UTC-midnight encoding\'s calendar day, on any server', () => {
			const time = CalDAV.toICALTime(D('2026-06-02T00:00:00Z'), true)
			assert.deepEqual([time.year, time.month, time.day, time.isDate], [2026, 6, 2, true])
		})

		it('keeps a timed value an absolute UTC instant', () => {
			const time = CalDAV.toICALTime(D('2026-06-01T22:00:00Z'), false)
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

		const bundledRaw = [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Gym',
			'DTSTART:20260704T073000Z', 'DTEND:20260704T083000Z',
			'RRULE:FREQ=WEEKLY;BYDAY=SA,MO,WE',
			'END:VEVENT',
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Gym',
			'DTSTART:20260711T200000Z', 'DTEND:20260711T210000Z',
			'RECURRENCE-ID:20260711T073000Z',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n')

		const emStub = () => ({ removed: new Array<Entry>(), find: () => Promise.resolve([]), remove(entry: Entry) { this.removed.push(entry) } })

		const stubbed = () => {
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			const client = {
				updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
			}
			;(dav as unknown as { client: unknown }).client = Promise.resolve(client)
			return dav
		}

		it('updateEntry writes VALUE=DATE properties carrying the canonical UTC dates, wherever the server runs', async () => {
			const existing = new Entry({
				id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Trip', uri: 'https://example.com/cal/e1.ics',
				start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), allDay: false,
				timeZone: 'Europe/Berlin', data: { raw },
			})
			const incoming = new Entry({
				sourceId: 's', type: EntryType.Event, heading: 'Trip', allDay: true, timeZone: 'Europe/Berlin',
				start: D('2026-06-02T00:00:00Z'), end: D('2026-06-03T00:00:00Z'),
				exdates: [new Date('2026-06-08T00:00:00Z').getTime()],
			})
			await stubbed().updateEntry(emStub() as never, existing, incoming)
			assert.match(existing.data!.raw!, /DTSTART;VALUE=DATE:20260602/)
			assert.match(existing.data!.raw!, /DTEND;VALUE=DATE:20260603/)
			assert.match(existing.data!.raw!, /EXDATE;VALUE=DATE:20260608/)
		})

		it('a timed move on a zoneless resource stays in the UTC form', async () => {
			const existing = new Entry({
				id: 'e2', sourceId: 's', type: EntryType.Event, heading: 'Trip', uri: 'https://example.com/cal/e2.ics',
				start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), allDay: false, data: { raw },
			})
			const incoming = new Entry({ ...existing, start: D('2026-06-02T10:00:00Z'), end: D('2026-06-02T11:00:00Z') } as Partial<Entry>)
			await stubbed().updateEntry(emStub() as never, existing, incoming)
			assert.match(existing.data!.raw!, /DTSTART:20260602T100000Z/)
			assert.match(existing.data!.raw!, /DTEND:20260602T110000Z/)
			assert.doesNotMatch(existing.data!.raw!, /DTSTART;TZID/)
		})

		it('updateEntry on an override row edits ITS component, never the bundled master', async () => {
			const override = new Entry({
				id: 'o1', sourceId: 's', type: EntryType.Event, heading: 'Gym', uri: 'https://example.com/cal/gym.ics',
				start: D('2026-07-11T20:00:00Z'), end: D('2026-07-11T21:00:00Z'), allDay: false,
				recurrenceId: new Date('2026-07-11T07:30:00Z') as any, data: { raw: bundledRaw },
			})
			const incoming = new Entry({ ...override, heading: 'Late Gym' } as Partial<Entry>)
			await stubbed().updateEntry(emStub() as never, override, incoming)
			const components = new ICAL.Component(ICAL.parse(override.data!.raw!)).getAllSubcomponents('vevent')
			const masterComponent = components.find(component => !component.getFirstPropertyValue('recurrence-id'))!
			const overrideComponent = components.find(component => component.getFirstPropertyValue('recurrence-id'))!
			assert.match(override.data!.raw!, /RRULE:FREQ=WEEKLY/)
			assert.equal(masterComponent.getFirstPropertyValue('summary')?.toString(), 'Gym')
			assert.equal(overrideComponent.getFirstPropertyValue('summary')?.toString(), 'Late Gym')
		})

		it('excludeOccurrence writes the occurrence\'s canonical DATE', async () => {
			const master = new Entry({
				id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Trip', uri: 'https://example.com/cal/m.ics',
				allDay: true, timeZone: 'Europe/Berlin', data: { raw },
			})
			await stubbed().excludeOccurrence(emStub() as never, master, new Date('2026-06-08T00:00:00Z'))
			assert.match(master.data!.raw!, /EXDATE;VALUE=DATE:20260608/)
		})

		it('excludeOccurrence strips a bundled override of that instant — EXDATE alone would leave the override alive', async () => {
			const master = new Entry({
				id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Gym', uri: 'https://example.com/cal/gym.ics',
				allDay: false, data: { raw: bundledRaw },
			})
			const overrideRow = new Entry({
				id: 'o1', sourceId: 's', recurrenceMasterId: 'm', recurrenceId: new Date('2026-07-11T07:30:00Z') as any,
				uri: 'https://example.com/cal/gym.ics', type: EntryType.Event, heading: 'Gym',
			})
			const em = { removed: new Array<Entry>(), find: (_: unknown, where: any) => Promise.resolve(where.recurrenceMasterId ? [overrideRow] : []), remove(entry: Entry) { this.removed.push(entry) } }
			await stubbed().excludeOccurrence(em as never, master, new Date('2026-07-11T07:30:00Z'))
			assert.match(master.data!.raw!, /EXDATE:20260711T073000Z/)
			assert.doesNotMatch(master.data!.raw!, /RECURRENCE-ID/)
			assert.match(master.data!.raw!, /RRULE:FREQ=WEEKLY/)
			assert.deepEqual(em.removed, [overrideRow])
		})
	})

	describe('concurrency (stale If-Match etags)', () => {
		const raw = (description: string) => [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Gym', `DESCRIPTION:${description}`,
			'DTSTART:20260704T070000Z', 'DTEND:20260704T080000Z',
			'END:VEVENT', 'END:VCALENDAR',
		].join('\r\n')

		const entry = () => new Entry({
			id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Gym', description: 'local', uri: 'https://example.com/cal/gym.ics',
			start: D('2026-07-04T07:00:00Z'), end: D('2026-07-04T08:00:00Z'), allDay: false,
			data: { raw: raw('local'), etag: 'e-stale' },
		})

		const stubbed = (puts: Array<{ etag?: string, data: string, ok: boolean }>, results: Array<{ ok: boolean, status?: number }>) => {
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			;(dav as unknown as { client: unknown }).client = Promise.resolve({
				updateCalendarObject: ({ calendarObject }: { calendarObject: { etag?: string, data: string } }) => {
					const result = results[puts.length]!
					puts.push({ etag: calendarObject.etag, data: calendarObject.data, ok: result.ok })
					return Promise.resolve({ ...result, headers: { get: () => null } })
				},
				fetchCalendarObjects: () => Promise.resolve([{ url: 'https://example.com/cal/gym.ics', etag: 'e-fresh', data: raw('server-normalized') }]),
			})
			return dav
		}

		it('a 412 refreshes the resource and re-applies the SAME edit onto the current copy, once', async () => {
			const puts = new Array<{ etag?: string, data: string, ok: boolean }>()
			const existing = entry()
			const incoming = new Entry({ ...existing, start: D('2026-07-04T08:00:00Z'), end: D('2026-07-04T09:00:00Z') } as Partial<Entry>)
			await stubbed(puts, [{ ok: false, status: 412 }, { ok: true }]).updateEntry({ find: () => Promise.resolve([]) } as never, existing, incoming)
			assert.equal(puts.length, 2)
			assert.equal(puts[0]!.etag, 'e-stale')
			assert.equal(puts[1]!.etag, 'e-fresh')
			assert.match(puts[1]!.data, /DESCRIPTION:server-normalized/)
			assert.match(puts[1]!.data, /DTSTART:20260704T080000Z/)
			assert.equal(existing.data!.raw, puts[1]!.data)
		})

		it('a second 412 propagates — something is genuinely racing us', async () => {
			const puts = new Array<{ etag?: string, data: string, ok: boolean }>()
			const existing = entry()
			const incoming = new Entry({ ...existing, heading: 'Late Gym' } as Partial<Entry>)
			await assert.rejects(
				() => stubbed(puts, [{ ok: false, status: 412 }, { ok: false, status: 412 }]).updateEntry({ find: () => Promise.resolve([]) } as never, existing, incoming),
				/CalDAV update failed: 412/,
			)
			assert.equal(puts.length, 2)
			assert.equal(existing.data!.raw, raw('local'))
		})
	})

	describe('zoned resources (TZID-authored, as Google writes them)', () => {
		const vtimezone = [
			'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
			'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
			'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
			'END:VTIMEZONE',
		]
		const zonedRaw = (overrides = false) => [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			...vtimezone,
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Gym',
			'DTSTART;TZID=Europe/Berlin:20260704T093000',
			'DTEND;TZID=Europe/Berlin:20260704T103000',
			'RRULE:FREQ=WEEKLY;BYDAY=SA,MO,WE',
			'END:VEVENT',
			...!overrides ? [] : [
				'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Gym',
				'DTSTART;TZID=Europe/Berlin:20260711T220000',
				'DTEND;TZID=Europe/Berlin:20260711T230000',
				'RECURRENCE-ID;TZID=Europe/Berlin:20260711T093000',
				'END:VEVENT',
			],
			'END:VCALENDAR',
		].join('\r\n')

		const stubbed = () => {
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			;(dav as unknown as { client: unknown }).client = Promise.resolve({
				updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
			})
			return dav
		}

		const masterRow = (raw: string, recurrence?: Recurrence) => new Entry({
			id: 'm', sourceId: 's', type: EntryType.Event, heading: 'Gym', uri: 'https://example.com/cal/gym.ics',
			start: D('2026-07-04T07:30:00Z'), end: D('2026-07-04T08:30:00Z'), allDay: false,
			timeZone: 'Europe/Berlin', recurrence, data: { raw },
		})

		it('a time shift writes the new WALL CLOCK in the authored zone — never the UTC form', async () => {
			const existing = masterRow(zonedRaw())
			const incoming = new Entry({ ...existing, start: D('2026-07-04T08:00:00Z'), end: D('2026-07-04T09:00:00Z') } as Partial<Entry>)
			await stubbed().updateEntry({ find: () => Promise.resolve([]) } as never, existing, incoming)
			assert.match(existing.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20260704T100000/)
			assert.match(existing.data!.raw!, /DTEND;TZID=Europe\/Berlin:20260704T110000/)
			assert.doesNotMatch(existing.data!.raw!, /DTSTART[^:]*:20260704T080000/)
		})

		it('a series shift also shifts bundled override RECURRENCE-IDs (rows included) but keeps the overrides\' own times', async () => {
			const rule = Recurrence.fromRRule('FREQ=WEEKLY;BYDAY=SA,MO,WE')
			const existing = masterRow(zonedRaw(true), rule)
			const overrideRow = new Entry({ id: 'o', sourceId: 's', recurrenceMasterId: 'm', uri: existing.uri, type: EntryType.Event, heading: 'Gym', recurrenceId: new Date('2026-07-11T07:30:00Z') as any })
			const em = { find: (_: unknown, where: { recurrenceMasterId?: string }) => Promise.resolve(where.recurrenceMasterId ? [overrideRow] : []) }
			const incoming = new Entry({ ...existing, recurrence: rule, start: D('2026-07-04T08:00:00Z'), end: D('2026-07-04T09:00:00Z') } as Partial<Entry>)
			await stubbed().updateEntry(em as never, existing, incoming)
			assert.match(existing.data!.raw!, /RECURRENCE-ID;TZID=Europe\/Berlin:20260711T100000/)
			assert.match(existing.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20260711T220000/)
			assert.equal(CalDAV.instantOf(overrideRow.recurrenceId), new Date('2026-07-11T08:00:00Z').getTime())
		})

		it('excludeOccurrence writes the EXDATE in DTSTART\'s authored zone form', async () => {
			const master = masterRow(zonedRaw())
			await stubbed().excludeOccurrence({ find: () => Promise.resolve([]) } as never, master, new Date('2026-07-11T07:30:00Z'))
			assert.match(master.data!.raw!, /EXDATE;TZID=Europe\/Berlin:20260711T093000/)
			assert.doesNotMatch(master.data!.raw!, /EXDATE[^:]*:20260711T073000/)
		})
	})

	describe('bundled-resource sync (master + overrides in one resource)', () => {
		const bundledRaw = [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Gym',
			'DTSTART:20260704T073000Z', 'DTEND:20260704T083000Z',
			'RRULE:FREQ=WEEKLY;BYDAY=SA,MO,WE',
			'END:VEVENT',
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Gym',
			'DTSTART:20260711T200000Z', 'DTEND:20260711T210000Z',
			'RECURRENCE-ID:20260711T073000Z',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n')

		const sync = async (existing: Array<Entry>, data: string, etag = 'e1') => {
			const source = new Source({ id: 'src1', integrationId: 'i1', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event], name: 'Cal' })
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			const client = {
				syncCollection: () => Promise.resolve([{ href: '/cal/gym.ics', status: 200, raw: { multistatus: { syncToken: 't2' } } }]),
				fetchCalendarObjects: () => Promise.resolve([{ url: 'https://example.com/cal/gym.ics', etag, data }]),
			}
			;(dav as unknown as { client: unknown }).client = Promise.resolve(client)
			const em = {
				persisted: new Array<Entry>(),
				removed: new Array<Entry>(),
				find: (Type: unknown) => Promise.resolve(Type === Source ? [source] : [...existing]),
				findOne: () => Promise.resolve(null),
				persist(entry: Entry) { this.persisted.push(entry) },
				remove(entry: Entry) { this.removed.push(entry) },
			}
			const changed = await (dav as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> }).syncSourceEntries(em, source)
			return { em, changed, source }
		}

		it('a plain single-component resource still ingests as exactly one row', async () => {
			const plainRaw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VEVENT', 'UID:u9', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Standup',
				'DTSTART:20260706T090000Z', 'DTEND:20260706T091500Z',
				'END:VEVENT', 'END:VCALENDAR',
			].join('\r\n')
			const { em } = await sync([], plainRaw)
			assert.equal(em.persisted.length, 1)
			assert.equal(em.removed.length, 0)
			const [entry] = em.persisted
			assert.equal(entry!.heading, 'Standup')
			assert.equal(entry!.recurrenceId, undefined)
			assert.equal(entry!.recurrenceMasterId, undefined)
			assert.equal(entry!.start?.valueOf(), new Date('2026-07-06T09:00:00Z').getTime())
		})

		it('ingests all-day DATE values as canonical UTC midnights — never the server\'s local midnight', async () => {
			const allDayRaw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VEVENT', 'UID:u8', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Exam Preparation',
				'DTSTART;VALUE=DATE:20260712', 'DTEND;VALUE=DATE:20260718',
				'END:VEVENT', 'END:VCALENDAR',
			].join('\r\n')
			const { em } = await sync([], allDayRaw)
			const [entry] = em.persisted
			assert.equal(entry!.allDay, true)
			assert.equal(entry!.start?.valueOf(), Date.UTC(2026, 6, 12))
			assert.equal(entry!.end?.valueOf(), Date.UTC(2026, 6, 18))
		})

		it('ingests one row per component: the master AND the overridden occurrence, linked by UID', async () => {
			const { em } = await sync([], bundledRaw)
			assert.equal(em.persisted.length, 2)
			const master = em.persisted.find(entry => entry.recurrence && !entry.recurrenceId)!
			const override = em.persisted.find(entry => entry.recurrenceId)!
			assert.ok(master && override)
			assert.equal(master.uri, override.uri)
			assert.equal(override.recurrenceMasterId, master.id)
			assert.equal(new Date(override.recurrenceId!.toString()).getTime(), new Date('2026-07-11T07:30:00Z').getTime())
			assert.equal(override.start?.valueOf(), new Date('2026-07-11T20:00:00Z').getTime())
		})

		it('drops the override row when the occurrence is reverted to the series', async () => {
			const first = await sync([], bundledRaw)
			const revertedRaw = bundledRaw.split('\r\n').slice(0, 11).concat('END:VCALENDAR').join('\r\n')
			const { em } = await sync(first.em.persisted, revertedRaw, 'e2')
			assert.equal(em.persisted.length, 0)
			assert.equal(em.removed.length, 1)
			assert.ok(em.removed[0]!.recurrenceId)
		})
	})

	describe('editableCopy', () => {
		it('keeps the identity and the credentials as held', () => {
			const copy = new CalDAV({ uri: 'https://dav/', credentials: { username: 'u', password: '' }, sources: [] as any }).editableCopy()
			assert.ok(copy instanceof CalDAV)
			assert.equal(copy.uri, 'https://dav/')
			assert.deepEqual(copy.credentials, { username: 'u', password: '' })
		})
	})

	describe('fetchObjects (resilient multiget)', () => {
		const call = (client: unknown, urls: Array<string>): Promise<Array<{ url: string }>> => (new CalDAVSyncEngine() as any).fetchObjects(client, { url: 'https://cal/' }, urls)

		it('returns the batch result untouched when the multiget succeeds (one request, fast path)', async () => {
			let calls = 0
			const client = { fetchCalendarObjects: ({ objectUrls }: { objectUrls: Array<string> }) => { calls++; return Promise.resolve(objectUrls.map(url => ({ url }))) } }
			const objects = await call(client, ['a', 'b', 'c'])
			assert.deepEqual(objects.map(o => o.url), ['a', 'b', 'c'])
			assert.equal(calls, 1)
		})

		it('falls back to per-object fetches and skips the gone one when the batch multiget throws', async () => {
			const gone = 'b'
			const client = {
				fetchCalendarObjects: ({ objectUrls }: { objectUrls: Array<string> }) => {
					if (objectUrls.length > 1) {
						return Promise.reject(new Error('Collection query failed: 404 Not Found'))
					}
					if (objectUrls[0] === gone) {
						return Promise.reject(new Error('Collection query failed: 404 Not Found'))
					}
					return Promise.resolve([{ url: objectUrls[0] }])
				},
			}
			const objects = await call(client, ['a', 'b', 'c'])
			assert.deepEqual(objects.map(o => o.url), ['a', 'c'])
		})
	})
})

describe('CalDAV credentials on the wire', () => {
	const account = () => new CalDAV({ uri: 'https://example', credentials: { username: 'someone', password: 'typed' }, sources: [] as never })

	it('answers with the account but a blank password — the browser only ever needs the label', () => {
		assert.deepEqual(wireOf(account()).credentials, { username: 'someone', password: '' })
	})

	it('delivers the password when it is the browser asking', () => {
		assert.deepEqual(asBrowser(() => wireOf(account())).credentials, { username: 'someone', password: 'typed' })
	})

	it('never carries a live connection', () => {
		const integration = account()
		integration.client = Promise.resolve({ credentials: { password: 'typed' } }) as never
		assert.equal('client' in wireOf(integration), false)
	})
})

describe('CalDAV source discovery (entry types per collection)', () => {
	const discover = (calendars: Array<{ url: string, displayName?: string, components?: Array<string> }>) => {
		const dav = new CalDAV({ uri: 'https://dav/', credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			fetchCalendars: () => Promise.resolve(calendars),
			fetchCalendarUserAddresses: () => Promise.resolve([]),
		})
		return (dav as unknown as { fetchSources(): Promise<Array<Source>> }).fetchSources()
	}

	it('gives a collection that accepts both types ONE source holding both', async () => {
		const sources = await discover([{ url: 'https://dav/cal/', displayName: 'Home', components: ['VEVENT', 'VTODO'] }])
		assert.equal(sources.length, 1)
		assert.deepEqual(sources[0]!.entryTypes, [EntryType.Event, EntryType.Task])
		assert.equal(sources[0]!.name, 'Home')
	})

	it('narrows the types to what the collection declares', async () => {
		const [events] = await discover([{ url: 'https://dav/work/', components: ['VEVENT'] }])
		assert.deepEqual(events!.entryTypes, [EntryType.Event])
		const [tasks] = await discover([{ url: 'https://dav/todo/', components: ['VTODO'] }])
		assert.deepEqual(tasks!.entryTypes, [EntryType.Task])
	})

	it('reads an absent or empty component set as both types', async () => {
		for (const components of [undefined, []]) {
			const [source] = await discover([{ url: 'https://dav/any/', components }])
			assert.deepEqual(source!.entryTypes, [EntryType.Event, EntryType.Task])
		}
	})

	it('drops a collection holding nothing mitra models', async () => {
		const sources = await discover([
			{ url: 'https://dav/journal/', components: ['VJOURNAL'] },
			{ url: 'https://dav/cal/', components: ['VEVENT'] },
		])
		assert.deepEqual(sources.map(source => source.uri), ['https://dav/cal/'])
	})
})

describe('CalDAV sync ingests every type the collection holds', () => {
	const resource = (uid: string, body: Array<string>) => [
		'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
		...body.slice(0, 1), `UID:${uid}`, 'DTSTAMP:20260101T000000Z', ...body.slice(1),
		'END:VCALENDAR',
	].join('\r\n')

	const eventRaw = resource('u-event', [
		'BEGIN:VEVENT', 'SUMMARY:Standup', 'DTSTART:20260706T090000Z', 'DTEND:20260706T091500Z', 'END:VEVENT',
	])
	const taskRaw = resource('u-task', [
		'BEGIN:VTODO', 'SUMMARY:Buy milk', 'DTSTART:20260706T170000Z', 'DUE:20260706T180000Z',
		'STATUS:NEEDS-ACTION', 'END:VTODO',
	])

	const sync = async () => {
		const source = new Source({ id: 'src1', integrationId: 'i1', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event, EntryType.Task], name: 'Home' })
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		let syncCollectionCalls = 0
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			syncCollection: () => {
				syncCollectionCalls++
				return Promise.resolve([
					{ href: '/cal/standup.ics', status: 200, raw: { multistatus: { syncToken: 't2' } } },
					{ href: '/cal/milk.ics', status: 200 },
				])
			},
			fetchCalendarObjects: () => Promise.resolve([
				{ url: 'https://example.com/cal/standup.ics', etag: 'e1', data: eventRaw },
				{ url: 'https://example.com/cal/milk.ics', etag: 'e2', data: taskRaw },
			]),
		})
		const em = {
			persisted: new Array<Entry>(),
			removed: new Array<Entry>(),
			find: () => Promise.resolve([]),
			findOne: () => Promise.resolve(null),
			persist(entry: Entry) { this.persisted.push(entry) },
			remove(entry: Entry) { this.removed.push(entry) },
		}
		const changed = await (dav as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> }).syncSourceEntries(em, source)
		return { em, changed, source, syncCollectionCalls }
	}

	it('files a VEVENT and a VTODO of the same collection as two rows of the right types', async () => {
		const { em, changed } = await sync()
		assert.equal(changed, true)
		assert.deepEqual(em.persisted.map(entry => [entry.heading, entry.type]), [
			['Standup', EntryType.Event],
			['Buy milk', EntryType.Task],
		])
		const task = em.persisted.find(entry => entry.type === EntryType.Task)!
		assert.equal(task.end?.valueOf(), new Date('2026-07-06T18:00:00Z').getTime())
		assert.equal(task.status, TaskStatus.ToDo)
		assert.equal(em.removed.length, 0)
	})

	it('walks the collection once and keeps ONE sync token', async () => {
		const { source, syncCollectionCalls } = await sync()
		assert.equal(syncCollectionCalls, 1)
		assert.deepEqual(source.syncState, { syncToken: 't2' })
	})
})

describe('CalDAV zone authoring (VTIMEZONE generation)', () => {
	const stubbed = () => {
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
		})
		return dav
	}
	const em = { find: () => Promise.resolve([]) } as never

	const utcRaw = [
		'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
		'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Test',
		'DTSTART:20260704T070000Z', 'DTEND:20260704T080000Z',
		'END:VEVENT', 'END:VCALENDAR',
	].join('\r\n')

	const row = (raw: string, timeZone: string | null) => new Entry({
		id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Test', uri: 'https://example.com/cal/e1.ics',
		start: D('2026-07-04T07:00:00Z'), end: D('2026-07-04T08:00:00Z'), allDay: false, timeZone, data: { raw },
	})

	it('picking a zone the resource lacks writes TZID local time AND embeds the generated VTIMEZONE', async () => {
		const existing = row(utcRaw, null)
		const incoming = new Entry({ ...existing, timeZone: 'Europe/Berlin' } as Partial<Entry>)
		await stubbed().updateEntry(em, existing, incoming)
		assert.match(existing.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20260704T090000/)
		assert.match(existing.data!.raw!, /DTEND;TZID=Europe\/Berlin:20260704T100000/)
		assert.match(existing.data!.raw!, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Berlin/)
		assert.doesNotMatch(existing.data!.raw!, /DTSTART[^:]*:20260704T070000Z/)
	})

	it('re-zoning drops the previous, now-unreferenced VTIMEZONE', async () => {
		const berlin = row(utcRaw, null)
		await stubbed().updateEntry(em, berlin, new Entry({ ...berlin, timeZone: 'Europe/Berlin' } as Partial<Entry>))
		const existing = row(berlin.data!.raw!, 'Europe/Berlin')
		const incoming = new Entry({ ...existing, timeZone: 'Asia/Tehran' } as Partial<Entry>)
		await stubbed().updateEntry(em, existing, incoming)
		assert.match(existing.data!.raw!, /BEGIN:VTIMEZONE\r\nTZID:Asia\/Tehran/)
		assert.doesNotMatch(existing.data!.raw!, /TZID:Europe\/Berlin/)
	})

	it('authoring \'UTC\' explicitly writes the plain Z form — RFC 5545 forbids a TZID naming UTC', async () => {
		const existing = row(utcRaw, null)
		await stubbed().updateEntry(em, existing, new Entry({ ...existing, timeZone: 'UTC' } as Partial<Entry>))
		assert.match(existing.data!.raw!, /DTSTART:20260704T070000Z/)
		assert.doesNotMatch(existing.data!.raw!, /TZID/)
		assert.doesNotMatch(existing.data!.raw!, /VTIMEZONE/)
	})

	it('clearing a zone (back to UTC) restores the plain Z form and drops the VTIMEZONE', async () => {
		const berlin = row(utcRaw, null)
		await stubbed().updateEntry(em, berlin, new Entry({ ...berlin, timeZone: 'Europe/Berlin' } as Partial<Entry>))
		const existing = row(berlin.data!.raw!, 'Europe/Berlin')
		await stubbed().updateEntry(em, existing, new Entry({ ...existing, timeZone: null } as Partial<Entry>))
		assert.match(existing.data!.raw!, /DTSTART:20260704T070000Z/)
		assert.doesNotMatch(existing.data!.raw!, /VTIMEZONE/)
	})
})

describe('CalDAV floating times', () => {
	const Private = CalDAV as unknown as { instantFrom(time: unknown): Date | undefined, isFloating(value: unknown): boolean }

	const parseDtstart = (line: string) => {
		const raw = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//t//EN', 'BEGIN:VEVENT', 'UID:u', line, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
		return new ICAL.Component(ICAL.parse(raw)).getFirstSubcomponent('vevent')!.getFirstPropertyValue('dtstart')
	}

	it('reads a bare local DTSTART as a FLOATING as-if-UTC instant', () => {
		const dtstart = parseDtstart('DTSTART:20260704T090000')
		assert.equal(Private.isFloating(dtstart), true)
		assert.equal(Private.instantFrom(dtstart)!.toISOString(), '2026-07-04T09:00:00.000Z')
	})

	it('does not mistake a UTC or date-only value for floating', () => {
		assert.equal(Private.isFloating(parseDtstart('DTSTART:20260704T090000Z')), false)
		assert.equal(Private.isFloating(parseDtstart('DTSTART;VALUE=DATE:20260704')), false)
	})

	it('writes a floating entry as a bare local time — neither TZID nor Z — round-tripping the wall clock', async () => {
		const stubbed = () => {
			const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
			;(dav as unknown as { client: unknown }).client = Promise.resolve({
				updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
			})
			return dav
		}
		const utcRaw = [
			'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
			'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Pill',
			'DTSTART:20260704T090000Z', 'DTEND:20260704T091500Z',
			'END:VEVENT', 'END:VCALENDAR',
		].join('\r\n')
		const existing = new Entry({
			id: 'e1', sourceId: 's', type: EntryType.Event, heading: 'Pill', uri: 'https://example.com/cal/e1.ics',
			start: D('2026-07-04T09:00:00Z'), end: D('2026-07-04T09:15:00Z'), allDay: false, timeZone: null, data: { raw: utcRaw },
		})
		const incoming = new Entry({ ...existing, timeZone: FLOATING_TIME_ZONE } as Partial<Entry>)
		await stubbed().updateEntry({ find: () => Promise.resolve([]) } as never, existing, incoming)
		assert.match(existing.data!.raw!, /DTSTART:20260704T090000\r\n/)
		assert.doesNotMatch(existing.data!.raw!, /DTSTART[^\r\n]*TZID/)
		assert.doesNotMatch(existing.data!.raw!, /VTIMEZONE/)
		assert.equal(Private.instantFrom(parseDtstart('DTSTART:20260704T090000'))!.toISOString(), '2026-07-04T09:00:00.000Z')
	})
})

describe('CalDAV series created in mitra survive DST (the reported bug)', () => {
	const source = () => new Source({ id: 's', integrationId: 'i', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event], name: 'Cal' })

	const stubbedCreate = () => {
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			createCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
		})
		return { dav, em: { findOne: () => Promise.resolve(source()), persist() { } } as never }
	}

	const syncBack = async (raw: string, uri: string) => {
		const src = source()
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			syncCollection: () => Promise.resolve([{ href: uri, status: 200, raw: { multistatus: { syncToken: 't1' } } }]),
			fetchCalendarObjects: () => Promise.resolve([{ url: uri, etag: 'e1', data: raw }]),
		})
		const persisted = new Array<Entry>()
		const em = {
			find: (Type: unknown) => Promise.resolve(Type === Source ? [src] : []),
			findOne: () => Promise.resolve(null),
			persist(entry: Entry) { persisted.push(entry) },
			remove() { },
		}
		await (dav as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> }).syncSourceEntries(em, src)
		return persisted
	}

	it('a weekly 10:00 Berlin series keeps its zone across create → sync, so it can no longer drift to 09:00', async () => {
		const entry = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Test via Mitra', timeZone: 'Europe/Berlin',
			start: D('2026-10-11T08:00:00Z'), end: D('2026-10-11T08:30:00Z'),
			recurrence: new Recurrence({ freq: 'WEEKLY' }),
		})
		const { dav, em } = stubbedCreate()
		await dav.createEntry(em, entry)
		assert.match(entry.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20261011T100000/)
		assert.match(entry.data!.raw!, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Berlin/)
		assert.doesNotMatch(entry.data!.raw!, /DTSTART[^:]*:\d{8}T\d{6}Z/)

		const [master] = await syncBack(entry.data!.raw!, entry.uri!)
		assert.equal(master!.timeZone, 'Europe/Berlin')
		assert.equal(master!.start?.valueOf(), new Date('2026-10-11T08:00:00Z').getTime())
		assert.equal(master!.recurrence?.freq, 'WEEKLY')
	})
})

describe('CalDAV zoned reads resolve through Temporal, not the resource', () => {
	const uri = 'https://example.com/cal/z.ics'
	const source = () => new Source({ id: 's', integrationId: 'i', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event], name: 'Cal' })

	const sync = async (raw: string, existing: Array<Entry> = [], etag = 'e1', syncToken?: string) => {
		const src = source()
		src.syncState = syncToken ? { syncToken } : undefined
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			syncCollection: () => Promise.resolve([{ href: uri, status: 200, raw: { multistatus: { syncToken: 't2' } } }]),
			fetchCalendarObjects: () => Promise.resolve([{ url: uri, etag, data: raw }]),
		})
		const persisted = new Array<Entry>()
		const em = {
			find: (Type: unknown) => Promise.resolve(Type === Source ? [src] : [...existing]),
			findOne: () => Promise.resolve(null),
			persist(entry: Entry) { persisted.push(entry) },
			remove() { },
		}
		await (dav as unknown as { syncSourceEntries(em: unknown, source: Source): Promise<boolean> }).syncSourceEntries(em, src)
		return persisted
	}

	const vevent = (props: Array<string>, extra: Array<string> = []) => [
		'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...extra,
		'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Zoned', ...props, 'END:VEVENT',
		'END:VCALENDAR',
	].join('\r\n')

	it('a TZID resolves correctly even when the resource OMITS its VTIMEZONE (RFC 7809 servers)', async () => {
		const raw = vevent(['DTSTART;TZID=Europe/Berlin:20261011T100000', 'DTEND;TZID=Europe/Berlin:20261011T103000', 'RRULE:FREQ=WEEKLY'])
		const [entry] = await sync(raw)
		assert.equal(entry!.start?.valueOf(), new Date('2026-10-11T08:00:00Z').getTime())
		assert.equal(entry!.end?.valueOf(), new Date('2026-10-11T08:30:00Z').getTime())
		assert.equal(entry!.timeZone, 'Europe/Berlin')
	})

	it('a non-IANA TZID (a Microsoft zone name) keeps ical.js\' VTIMEZONE resolution and is NOT stored as the zone', async () => {
		const vtimezone = [
			'BEGIN:VTIMEZONE', 'TZID:W. Europe Standard Time',
			'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0200', 'DTSTART:19700101T000000', 'END:STANDARD',
			'END:VTIMEZONE',
		]
		const raw = vevent(['DTSTART;TZID=W. Europe Standard Time:20260704T100000', 'RRULE:FREQ=WEEKLY'], vtimezone)
		const [entry] = await sync(raw)
		assert.equal(entry!.start?.valueOf(), new Date('2026-07-04T08:00:00Z').getTime())
		assert.equal(entry!.timeZone, null)
	})

	it('an unchanged etag skips re-ingestion entirely, so the row keeps its stamped zone (the Radicale case)', async () => {
		const raw = vevent(['DTSTART:20261011T080000Z', 'RRULE:FREQ=WEEKLY'])
		const row = new Entry({
			id: 'r1', sourceId: 's', type: EntryType.Event, heading: 'Zoned', uri,
			start: D('2026-10-11T08:00:00Z'), timeZone: 'Europe/Berlin', data: { raw, etag: 'e1' },
		})
		const persisted = await sync(raw, [row], 'e1', 't1')
		assert.equal(persisted.length, 0)
		assert.equal(row.timeZone, 'Europe/Berlin')
	})
})
