import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DateTime } from '@3mo/date-time'
import { Entry, EntryStatus, EntryType } from '#features/entries'
import { Source } from '#features/sources'
import '#integrations/server/registerEngines.js'
import { CalDAV } from './CalDAV.js'

const D = (iso: string) => new Date(iso) as unknown as DateTime

describe('CalDAV STATUS', () => {
	describe('on a VTODO', () => {
		it('reads every status the spec defines', () => {
			assert.equal(CalDAV.statusFromICal('NEEDS-ACTION', 0), EntryStatus.ToDo)
			assert.equal(CalDAV.statusFromICal('IN-PROCESS', 0), EntryStatus.Doing)
			assert.equal(CalDAV.statusFromICal('COMPLETED', 0), EntryStatus.Done)
			assert.equal(CalDAV.statusFromICal('CANCELLED', 0), EntryStatus.Cancelled)
			assert.equal(CalDAV.statusFromICal('completed', 0), EntryStatus.Done)
		})

		it('falls back to PERCENT-COMPLETE, then to ToDo, when STATUS is missing, unknown or an event\'s', () => {
			assert.equal(CalDAV.statusFromICal(undefined, 0), EntryStatus.ToDo)
			assert.equal(CalDAV.statusFromICal(undefined, 100), EntryStatus.Done)
			assert.equal(CalDAV.statusFromICal('X-SOMETHING-ELSE', 100), EntryStatus.Done)
			assert.equal(CalDAV.statusFromICal('X-SOMETHING-ELSE', 0), EntryStatus.ToDo)
			assert.equal(CalDAV.statusFromICal('TENTATIVE', 0), EntryStatus.ToDo)
		})
	})

	describe('on a VEVENT', () => {
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

		const sync = async (raw: string, dav = new CalDAV({ credentials: { username: 'u', password: 'p' } })) => {
			const source = new Source({ id: 's', integrationId: 'i1', uri: 'https://example.com/cal/', entryTypes: [EntryType.Event], name: 'Home' })
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
			return persisted
		}

		it('reads the three statuses case-insensitively, and a task\'s or anything else as none', () => {
			assert.equal(CalDAV.eventStatusFromICal('CANCELLED'), EntryStatus.Cancelled)
			assert.equal(CalDAV.eventStatusFromICal('tentative'), EntryStatus.Tentative)
			assert.equal(CalDAV.eventStatusFromICal('CONFIRMED'), EntryStatus.Confirmed)
			assert.equal(CalDAV.eventStatusFromICal('COMPLETED'), undefined)
			assert.equal(CalDAV.eventStatusFromICal(undefined), undefined)
		})

		it('lands a cancelled event on its row', async () => {
			const [entry] = await sync(resource('STATUS:CANCELLED'))
			assert.equal(entry!.status, EntryStatus.Cancelled)
			assert.equal(entry!.cancelled, true)
		})

		it('reads none where the calendar holds no statuses, as Google until a recording says', async () => {
			const google = new class extends CalDAV {
				override get capabilities() { return super.capabilities.with({ entries: { statuses: [] } }) }
			}({ credentials: { username: 'u', password: 'p' } })
			const [entry] = await sync(resource('STATUS:CANCELLED'), google)
			assert.equal(entry!.status, undefined)
		})

		it('reads an occurrence another client cancelled through an override, and leaves the rest of the series standing', async () => {
			const raw = [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
				'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'DTSTART:20260602T090000Z', 'DTEND:20260602T100000Z',
				'RRULE:FREQ=WEEKLY', 'SUMMARY:Volleyball', 'END:VEVENT',
				'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'RECURRENCE-ID:20260609T090000Z',
				'DTSTART:20260609T090000Z', 'DTEND:20260609T100000Z', 'SUMMARY:Volleyball', 'STATUS:CANCELLED', 'END:VEVENT',
				'END:VCALENDAR',
			].join('\r\n')
			const rows = await sync(raw)
			const override = rows.find(row => row.recurrenceId)!
			const recurring = rows.find(row => !row.recurrenceId)!
			assert.equal(override.status, EntryStatus.Cancelled)
			assert.equal(recurring.status, undefined)
		})

		it('writes a cancellation and takes it back', async () => {
			const existing = event(resource())
			await stubbed().updateEntry(em(), existing, event(resource(), { status: EntryStatus.Cancelled }))
			assert.match(existing.data!.raw!, /STATUS:CANCELLED/)
			assert.equal(existing.status, EntryStatus.Cancelled)

			await stubbed().updateEntry(em(), existing, event(existing.data!.raw!, { status: undefined }))
			assert.doesNotMatch(existing.data!.raw!, /STATUS:/)
		})

		it('writes STATUS on a new event only when it has one', async () => {
			const created = async (fields: Partial<Entry>) => {
				const entry = new Entry({ sourceId: 's', type: EntryType.Event, heading: 'Standup', start: D('2026-06-02T09:00:00Z'), end: D('2026-06-02T10:00:00Z'), ...fields })
				await stubbed().createEntry(em(), entry)
				return entry.data!.raw!
			}
			assert.match(await created({ status: EntryStatus.Cancelled }), /STATUS:CANCELLED/)
			assert.doesNotMatch(await created({}), /STATUS:/)
		})
	})
})
