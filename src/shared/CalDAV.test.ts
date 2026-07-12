import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { CalDAV } from './CalDAV.js'
import { Entry, EntryType, FLOATING_TIME_ZONE } from './Entry.js'
import { Source, SourceType } from './Source.js'
import { Recurrence } from './Recurrence.js'

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
		it('writes an all-day DATE as the canonical UTC-midnight encoding\'s calendar day, on any server', () => {
			// All-day bounds are DATES stored as UTC midnights (see calendarDate.ts) — the value's own
			// UTC calendar day is the date, whatever zone the server (a Docker container, say) runs in.
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

		// A compliant server bundles a series and its overrides into ONE resource: the master VEVENT
		// (with the RRULE) plus one VEVENT per edited occurrence, carrying a RECURRENCE-ID.
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
			// All-day bounds reach the integration as canonical UTC-midnight date encodings — the routes
			// normalize the viewer's local midnights before the write (see backend/entries.ts).
			const incoming = new Entry({
				sourceId: 's', type: EntryType.Event, heading: 'Trip', allDay: true, timeZone: 'Europe/Berlin',
				start: D('2026-06-02T00:00:00Z'), end: D('2026-06-03T00:00:00Z'), // all-day Jun 2
				exdates: [new Date('2026-06-08T00:00:00Z').getTime()], // an excluded all-day Jun 8
			})
			await stubbed().updateEntry(emStub() as never, existing, incoming)
			assert.match(existing.data!.raw!, /DTSTART;VALUE=DATE:20260602/)
			assert.match(existing.data!.raw!, /DTEND;VALUE=DATE:20260603/) // the exclusive next day
			assert.match(existing.data!.raw!, /EXDATE;VALUE=DATE:20260608/)
		})

		// The zoneless-server baseline: a timed move on a UTC-authored resource keeps the exact UTC
		// form — no TZID parameter, trailing Z intact — locking that the authored-form logic (writeDate)
		// is a no-op for every plain CalDAV server.
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
			// The master component keeps its SUMMARY + RRULE; only the override component was renamed.
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
			await stubbed().excludeOccurrence(emStub() as never, master, new Date('2026-06-08T00:00:00Z')) // all-day Jun 8
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
			assert.doesNotMatch(master.data!.raw!, /RECURRENCE-ID/) // the override component is gone
			assert.match(master.data!.raw!, /RRULE:FREQ=WEEKLY/) // the master survives
			assert.deepEqual(em.removed, [overrideRow]) // and the local override row goes with it
		})
	})

	describe('concurrency (stale If-Match etags)', () => {
		// Google acknowledges a write, then re-normalizes the resource asynchronously and bumps the
		// etag AGAIN — so the etag stored from the write's own response is stale for the NEXT edit
		// within a sync cycle (the user-facing bug: move a series twice in a row → second move 412s).
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
				// The refetched CURRENT resource: the server re-normalized it (marker description) and bumped the etag.
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
			assert.equal(puts[1]!.etag, 'e-fresh') // the retry carries the refreshed etag…
			assert.match(puts[1]!.data, /DESCRIPTION:server-normalized/) // …and rebases on the refreshed resource…
			assert.match(puts[1]!.data, /DTSTART:20260704T080000Z/) // …with the same edit re-applied
			assert.equal(existing.data!.raw, puts[1]!.data) // the committed copy is the retried one
		})

		it('a second 412 propagates — something is genuinely racing us', async () => {
			const puts = new Array<{ etag?: string, data: string, ok: boolean }>()
			const existing = entry()
			const incoming = new Entry({ ...existing, heading: 'Late Gym' } as Partial<Entry>)
			await assert.rejects(
				() => stubbed(puts, [{ ok: false, status: 412 }, { ok: false, status: 412 }]).updateEntry({ find: () => Promise.resolve([]) } as never, existing, incoming),
				/CalDAV update failed: 412/,
			)
			assert.equal(puts.length, 2) // exactly one retry, never a loop
			assert.equal(existing.data!.raw, raw('local')) // the local copy stays untouched on failure
		})
	})

	describe('zoned resources (TZID-authored, as Google writes them)', () => {
		// The user-facing bug: moving a Berlin series 09:30 → 10:00 wrote the UTC wall clock (08:00)
		// into the TZID=Europe/Berlin property, so the server reinterpreted the series at 08:00 LOCAL.
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
			start: D('2026-07-04T07:30:00Z'), end: D('2026-07-04T08:30:00Z'), allDay: false, // 09:30–10:30 Berlin
			timeZone: 'Europe/Berlin', recurrence, data: { raw },
		})

		it('a time shift writes the new WALL CLOCK in the authored zone — never the UTC form', async () => {
			const existing = masterRow(zonedRaw())
			const incoming = new Entry({ ...existing, start: D('2026-07-04T08:00:00Z'), end: D('2026-07-04T09:00:00Z') } as Partial<Entry>) // 10:00–11:00 Berlin
			await stubbed().updateEntry({ find: () => Promise.resolve([]) } as never, existing, incoming)
			assert.match(existing.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20260704T100000/)
			assert.match(existing.data!.raw!, /DTEND;TZID=Europe\/Berlin:20260704T110000/)
			assert.doesNotMatch(existing.data!.raw!, /DTSTART[^:]*:20260704T080000/) // the UTC wall clock must never leak into the zone
		})

		it('a series shift also shifts bundled override RECURRENCE-IDs (rows included) but keeps the overrides\' own times', async () => {
			const rule = Recurrence.fromRRule('FREQ=WEEKLY;BYDAY=SA,MO,WE')
			const existing = masterRow(zonedRaw(true), rule)
			const overrideRow = new Entry({ id: 'o', sourceId: 's', recurrenceMasterId: 'm', uri: existing.uri, type: EntryType.Event, heading: 'Gym', recurrenceId: new Date('2026-07-11T07:30:00Z') as any })
			const em = { find: (_: unknown, where: { recurrenceMasterId?: string }) => Promise.resolve(where.recurrenceMasterId ? [overrideRow] : []) }
			const incoming = new Entry({ ...existing, recurrence: rule, start: D('2026-07-04T08:00:00Z'), end: D('2026-07-04T09:00:00Z') } as Partial<Entry>) // +30 min
			await stubbed().updateEntry(em as never, existing, incoming)
			assert.match(existing.data!.raw!, /RECURRENCE-ID;TZID=Europe\/Berlin:20260711T100000/) // anchored to the SHIFTED occurrence
			assert.match(existing.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20260711T220000/) // the exception keeps its custom time
			assert.equal(CalDAV.instantOf(overrideRow.recurrenceId), new Date('2026-07-11T08:00:00Z').getTime()) // the row follows
		})

		it('excludeOccurrence writes the EXDATE in DTSTART\'s authored zone form', async () => {
			const master = masterRow(zonedRaw())
			await stubbed().excludeOccurrence({ find: () => Promise.resolve([]) } as never, master, new Date('2026-07-11T07:30:00Z')) // 09:30 Berlin
			assert.match(master.data!.raw!, /EXDATE;TZID=Europe\/Berlin:20260711T093000/)
			assert.doesNotMatch(master.data!.raw!, /EXDATE[^:]*:20260711T073000/)
		})
	})

	describe('bundled-resource sync (master + overrides in one resource)', () => {
		// The user-facing bug: a Notion-Calendar-edited occurrence (synced into Google) rendered at its
		// original series time because only the resource's FIRST component was ingested.
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
			const source = new Source({ id: 'src1', integrationId: 'i1', uri: 'https://example.com/cal/', type: SourceType.Event, name: 'Cal' })
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

		// The BASELINE every plain CalDAV server exercises: one zoneless single-component resource →
		// exactly one row, no override bookkeeping — locking that the multi-component rewrite left the
		// common path untouched.
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
			// The production bug: date-only values read via toJSDate() land on the SERVER's midnight
			// (2h off in a UTC container viewed from Berlin), so all-day bars spilled into the next day
			// and sequential multi-day events overlapped. The date's own y/m/d IS the value.
			const allDayRaw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VEVENT', 'UID:u8', 'DTSTAMP:20260101T000000Z', 'SUMMARY:Exam Preparation',
				'DTSTART;VALUE=DATE:20260712', 'DTEND;VALUE=DATE:20260718',
				'END:VEVENT', 'END:VCALENDAR',
			].join('\r\n')
			const { em } = await sync([], allDayRaw)
			const [entry] = em.persisted
			assert.equal(entry!.allDay, true)
			assert.equal(entry!.start?.valueOf(), Date.UTC(2026, 6, 12)) // structural: read off y/m/d, no zone involved
			assert.equal(entry!.end?.valueOf(), Date.UTC(2026, 6, 18))
		})

		it('ingests one row per component: the master AND the overridden occurrence, linked by UID', async () => {
			const { em } = await sync([], bundledRaw)
			assert.equal(em.persisted.length, 2)
			const master = em.persisted.find(entry => entry.recurrence && !entry.recurrenceId)!
			const override = em.persisted.find(entry => entry.recurrenceId)!
			assert.ok(master && override)
			assert.equal(master.uri, override.uri) // same resource
			assert.equal(override.recurrenceMasterId, master.id) // linked by shared UID
			assert.equal(new Date(override.recurrenceId!.toString()).getTime(), new Date('2026-07-11T07:30:00Z').getTime())
			assert.equal(override.start?.valueOf(), new Date('2026-07-11T20:00:00Z').getTime()) // the MOVED time
		})

		it('drops the override row when the occurrence is reverted to the series', async () => {
			const first = await sync([], bundledRaw)
			const revertedRaw = bundledRaw.split('\r\n').slice(0, 11).concat('END:VCALENDAR').join('\r\n') // master only
			const { em } = await sync(first.em.persisted, revertedRaw, 'e2')
			assert.equal(em.persisted.length, 0) // master row reused, not duplicated
			assert.equal(em.removed.length, 1)
			assert.ok(em.removed[0]!.recurrenceId) // and it's the override that went
		})
	})

	describe('editableCopy', () => {
		it('keeps the identity but blanks the password — merge reads blank as "keep the stored one"', () => {
			const copy = new CalDAV({ uri: 'https://dav/', credentials: { username: 'u', password: 'secret' }, sources: [] as any }).editableCopy()
			assert.ok(copy instanceof CalDAV)
			assert.equal(copy.uri, 'https://dav/')
			assert.deepEqual(copy.credentials, { username: 'u', password: '' })
		})
	})

	describe('fetchObjects (resilient multiget)', () => {
		const dav = () => new CalDAV({ credentials: { username: 'u', password: 'p' } })
		const call = (client: unknown, urls: Array<string>) => (dav() as unknown as { fetchObjects(c: unknown, cal: { url: string }, u: Array<string>): Promise<Array<{ url: string }>> }).fetchObjects(client, { url: 'https://cal/' }, urls)

		it('returns the batch result untouched when the multiget succeeds (one request, fast path)', async () => {
			let calls = 0
			const client = { fetchCalendarObjects: ({ objectUrls }: { objectUrls: Array<string> }) => { calls++; return Promise.resolve(objectUrls.map(url => ({ url }))) } }
			const objects = await call(client, ['a', 'b', 'c'])
			assert.deepEqual(objects.map(o => o.url), ['a', 'b', 'c'])
			assert.equal(calls, 1) // no per-object fallback when the batch is fine
		})

		it('falls back to per-object fetches and skips the gone one when the batch multiget throws', async () => {
			// Mirrors tsdav: a batch with any per-href 404 throws wholesale; the gone href throws on its own too.
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
			assert.deepEqual(objects.map(o => o.url), ['a', 'c']) // 'b' dropped, sync still completes
		})
	})
})

// Mitra's own contributions on top of main's authored-zone preservation: PERSISTING a user-picked
// zone the resource doesn't already carry (generating its VTIMEZONE), and not corrupting another
// client's FLOATING times. Driven through the public write path with a stubbed DAV client.
describe('CalDAV zone authoring (VTIMEZONE generation)', () => {
	const stubbed = () => {
		const dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })
		;(dav as unknown as { client: unknown }).client = Promise.resolve({
			updateCalendarObject: () => Promise.resolve({ ok: true, headers: { get: () => null } }),
		})
		return dav
	}
	const em = { find: () => Promise.resolve([]) } as never

	// A UTC-authored resource — no VTIMEZONE, DTSTART in `Z` form — the shape every plain server stores.
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
		// Same instants, newly authored in Berlin (07:00Z = 09:00 CEST) — only the zone changed.
		const incoming = new Entry({ ...existing, timeZone: 'Europe/Berlin' } as Partial<Entry>)
		await stubbed().updateEntry(em, existing, incoming)
		assert.match(existing.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20260704T090000/)
		assert.match(existing.data!.raw!, /DTEND;TZID=Europe\/Berlin:20260704T100000/)
		assert.match(existing.data!.raw!, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Berlin/)
		assert.doesNotMatch(existing.data!.raw!, /DTSTART[^:]*:20260704T070000Z/) // the UTC form is gone
	})

	it('re-zoning drops the previous, now-unreferenced VTIMEZONE', async () => {
		// Start already authored in Berlin (with its VTIMEZONE), then re-zone to Tehran.
		const berlin = row(utcRaw, null)
		await stubbed().updateEntry(em, berlin, new Entry({ ...berlin, timeZone: 'Europe/Berlin' } as Partial<Entry>))
		const existing = row(berlin.data!.raw!, 'Europe/Berlin')
		const incoming = new Entry({ ...existing, timeZone: 'Asia/Tehran' } as Partial<Entry>)
		await stubbed().updateEntry(em, existing, incoming)
		assert.match(existing.data!.raw!, /BEGIN:VTIMEZONE\r\nTZID:Asia\/Tehran/)
		assert.doesNotMatch(existing.data!.raw!, /TZID:Europe\/Berlin/) // pruned — no property references it
	})

	it('authoring \'UTC\' explicitly writes the plain Z form — RFC 5545 forbids a TZID naming UTC', async () => {
		// It then syncs back as timeZone null, which expands identically (fixed UTC instants — see
		// occurrences.test.ts): the round trip is lossless in behavior, and other clients see the
		// conventional form instead of a degenerate TZID=UTC + VTIMEZONE.
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
	// The read helpers are the crux of floating correctness (as-if-UTC, deterministic on any server),
	// so they're pinned directly — private-static access on purpose, mirroring how the write path reverses.
	const Private = CalDAV as unknown as { instantFrom(time: unknown): Date | undefined, isFloating(value: unknown): boolean }

	const parseDtstart = (line: string) => {
		const raw = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//t//EN', 'BEGIN:VEVENT', 'UID:u', line, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
		return new ICAL.Component(ICAL.parse(raw)).getFirstSubcomponent('vevent')!.getFirstPropertyValue('dtstart')
	}

	it('reads a bare local DTSTART as a FLOATING as-if-UTC instant', () => {
		const dtstart = parseDtstart('DTSTART:20260704T090000') // no Z, no TZID
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
		assert.match(existing.data!.raw!, /DTSTART:20260704T090000\r\n/) // bare local — no Z
		assert.doesNotMatch(existing.data!.raw!, /DTSTART[^\r\n]*TZID/)
		assert.doesNotMatch(existing.data!.raw!, /VTIMEZONE/)
		assert.equal(Private.instantFrom(parseDtstart('DTSTART:20260704T090000'))!.toISOString(), '2026-07-04T09:00:00.000Z')
	})
})

describe('CalDAV series created in mitra survive DST (the reported bug)', () => {
	// The report: a recurring event CREATED in mitra rendered 10:00 all summer, then an hour earlier
	// (09:00) from late October, while the same series authored in Google held 10:00. mitra wrote a bare
	// UTC DTSTART with no TZID, so the next sync read its authoring zone back as null (see
	// syncSourceEntries) and the expansion fell to the fixed-UTC path that drifts an hour across the flip.
	// Authoring TZID + a generated VTIMEZONE keeps the zone through the create → sync round trip, so the
	// expansion stays on the wall-clock path (proven DST-safe in occurrences.test.ts).
	const source = () => new Source({ id: 's', integrationId: 'i', uri: 'https://example.com/cal/', type: SourceType.Event, name: 'Cal' })

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
		// Sunday 2026-10-11, 10:00–10:30 Berlin (CEST = 08:00Z), weekly across the Oct 25 DST end.
		const entry = new Entry({
			sourceId: 's', type: EntryType.Event, heading: 'Test via Mitra', timeZone: 'Europe/Berlin',
			start: D('2026-10-11T08:00:00Z'), end: D('2026-10-11T08:30:00Z'),
			recurrence: new Recurrence({ freq: 'WEEKLY' }),
		})
		const { dav, em } = stubbedCreate()
		await dav.createEntry(em, entry)
		// Authored zoned — never the bare-UTC anchor that caused the drift.
		assert.match(entry.data!.raw!, /DTSTART;TZID=Europe\/Berlin:20261011T100000/)
		assert.match(entry.data!.raw!, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Berlin/)
		assert.doesNotMatch(entry.data!.raw!, /DTSTART[^:]*:\d{8}T\d{6}Z/)

		// The read back: sync no longer wipes the zone to null — the whole bug in one assertion.
		const [master] = await syncBack(entry.data!.raw!, entry.uri!)
		assert.equal(master!.timeZone, 'Europe/Berlin')
		assert.equal(master!.start?.valueOf(), new Date('2026-10-11T08:00:00Z').getTime()) // 10:00 Berlin, exact, on any server
		assert.equal(master!.recurrence?.freq, 'WEEKLY')
	})
})

describe('CalDAV zoned reads resolve through Temporal, not the resource', () => {
	// ical.js keeps a TZID property's wall-clock FIELDS literal and only uses an embedded VTIMEZONE to
	// convert them — absent one, it silently degrades to "floating" and the instant becomes whatever
	// the server's local clock says. Temporal is the zone authority, so the sync decodes TZID values
	// itself ({@link CalDAV.instantFrom}) and the resource's VTIMEZONE is merely a courtesy for OTHER
	// clients — never a correctness dependency of our own pipeline.
	const uri = 'https://example.com/cal/z.ics'
	const source = () => new Source({ id: 's', integrationId: 'i', uri: 'https://example.com/cal/', type: SourceType.Event, name: 'Cal' })

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
		// Before: ical.js read this as floating → the instant depended on the container's TZ.
		const raw = vevent(['DTSTART;TZID=Europe/Berlin:20261011T100000', 'DTEND;TZID=Europe/Berlin:20261011T103000', 'RRULE:FREQ=WEEKLY'])
		const [entry] = await sync(raw)
		assert.equal(entry!.start?.valueOf(), new Date('2026-10-11T08:00:00Z').getTime()) // 10:00 CEST, on any server
		assert.equal(entry!.end?.valueOf(), new Date('2026-10-11T08:30:00Z').getTime())
		assert.equal(entry!.timeZone, 'Europe/Berlin')
	})

	it('a non-IANA TZID (a Microsoft zone name) keeps ical.js\' VTIMEZONE resolution and is NOT stored as the zone', async () => {
		// Temporal can't resolve it, so storing it would throw on every expansion; the resolved instants
		// stand and the series expands fixed — deterministic, if unadjusted across DST.
		const vtimezone = [
			'BEGIN:VTIMEZONE', 'TZID:W. Europe Standard Time',
			'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0200', 'DTSTART:19700101T000000', 'END:STANDARD',
			'END:VTIMEZONE',
		]
		const raw = vevent(['DTSTART;TZID=W. Europe Standard Time:20260704T100000', 'RRULE:FREQ=WEEKLY'], vtimezone)
		const [entry] = await sync(raw)
		assert.equal(entry!.start?.valueOf(), new Date('2026-07-04T08:00:00Z').getTime()) // resolved via the embedded +02:00
		assert.equal(entry!.timeZone, null) // sanitized — never handed to Temporal/Intl later
	})

	it('an unchanged etag skips re-ingestion entirely, so the row keeps its stamped zone (the Radicale case)', async () => {
		// Radicale returns a stable etag for the resource mitra just PUT, so the next sync's etag check
		// short-circuits and the create-stamped timeZone survives — which is why the original drift never
		// reproduced against a local Radicale: the wipe needed a server that re-normalizes the resource
		// (bumping the etag) the way Google does, forcing the re-read.
		const raw = vevent(['DTSTART:20261011T080000Z', 'RRULE:FREQ=WEEKLY']) // the OLD bare-UTC form, pre-fix
		const row = new Entry({
			id: 'r1', sourceId: 's', type: EntryType.Event, heading: 'Zoned', uri,
			start: D('2026-10-11T08:00:00Z'), timeZone: 'Europe/Berlin', data: { raw, etag: 'e1' },
		})
		const persisted = await sync(raw, [row], 'e1', 't1')
		assert.equal(persisted.length, 0) // nothing re-ingested
		assert.equal(row.timeZone, 'Europe/Berlin') // the stamped zone survives — no drift locally
	})
})
