import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Source } from '#features/sources'
import { Recurrence, RecurrenceFrequency, EntryOccurrenceChangeScope } from '#features/recurrence'
import { Participants } from '#features/participants/Participant.js'
import { IntegrationCapabilities, type OwnedField } from '#integrations'
import { CalDAV } from '#integrations/caldav/CalDAV.js'
import type { ValidationError } from '#infrastructure/validation'
import { Entry } from './Entry.js'
import { EntryPatch } from './EntryPatch.js'
import { EntryType } from './EntryType.js'
import { TaskStatus } from './TaskStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { EntryFiles } from './EntryFiles.js'

/** A calendar holding `types`, whose integration holds every field but `lacking` and may not do `cannot`. */
const calendar = (init: { id?: string, types?: Array<EntryType>, lacking?: Array<OwnedField>, cannot?: Partial<IntegrationCapabilities['entries']> } = {}) => {
	const integration = new class extends CalDAV {
		override get capabilities() { return new IntegrationCapabilities({ entries: init.cannot }) }
		override get ownership() { return super.ownership.without(...init.lacking ?? []) }
	}()
	return Object.assign(new Source({ id: init.id ?? 'home', uri: init.id ?? 'home', entryTypes: init.types ?? [EntryType.Event, EntryType.Task], name: 'Home' }), { integration })
}
const described = (errors: Iterable<ValidationError>) => [...errors].map(error => [error.message, error.fields])
/** What `source` refuses of `entry` once the entry is in it. */
const refusals = (entry: Entry, source: Source) => described(Object.assign(entry, { sourceId: source.id, source }).validate())
const start = new DateTime('2026-10-05T09:00:00Z')
const event = (init?: Partial<Entry>) => new Entry({ id: 'e', sourceId: 'home', type: EntryType.Event, heading: 'Talk', start, end: start.add({ hours: 1 }), ...init })
const patch = (init: Partial<EntryPatch>) => Object.assign(new EntryPatch(), init)

describe('Entry.validate', () => {
	it('finds nothing wrong with an entry the calendar can store', () => {
		assert.deepEqual(refusals(event({ transparency: Transparency.Free, visibility: Visibility.Private }), calendar()), [])
	})

	it('names every fact the calendar cannot store, each with its field', () => {
		const task = new Entry({ type: EntryType.Task, heading: 'Report', visibility: Visibility.Private, percentComplete: 0, due: start, participants: Participants.normalize([{ email: 'organizer@example.com', organizer: true }]) })
		assert.deepEqual(refusals(task, calendar({ lacking: ['participants', 'visibility', 'percentComplete', 'due'] })), [
			['This calendar does not support participants', ['participants']],
			['This calendar does not support visibility', ['visibility']],
			['This calendar does not support task progress', ['percentComplete']],
			['This calendar does not support due dates', ['due']],
		])
		assert.deepEqual(refusals(event({ transparency: Transparency.Free }), calendar({ lacking: ['transparency'] })), [['This calendar cannot mark an entry as free', ['transparency']]])
	})

	it('refuses a repeating entry where the calendar holds no rule, and a task in a state the calendar has not', () => {
		const repeating = event({ recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		assert.deepEqual(refusals(repeating, calendar({ lacking: ['recurrence'] })), [['This calendar cannot hold a repeating entry', ['recurrence']]])
		const doing = new Entry({ type: EntryType.Task, heading: 'Report', status: TaskStatus.Doing })
		assert.deepEqual(refusals(doing, calendar({ cannot: { statuses: [TaskStatus.ToDo, TaskStatus.Done] } })), [['This calendar cannot hold a task in progress', ['status']]])
		assert.deepEqual(refusals(doing, calendar()), [])
	})

	it('refuses an entry ending before it starts, and takes a moment, which ends where it starts', () => {
		assert.deepEqual(refusals(event({ end: start.add({ minutes: -1 }) }), calendar()), [['An entry cannot end before it starts', ['end']]])
		assert.deepEqual(refusals(event({ end: start }), calendar()), [])
	})

	it('names a type the calendar cannot hold', () => {
		assert.deepEqual(refusals(event(), calendar({ types: [EntryType.Task] })), [['This calendar cannot hold events', ['type']]])
	})

	it('refuses files where the calendar holds none, and nothing without files', () => {
		const attached = event({ attachments: EntryFiles.of([{ sourceUrl: 'https://example.com/plan.pdf' }]) })
		assert.deepEqual(refusals(attached, calendar({ lacking: ['attachments'] })), [['This calendar does not support attachments', ['attachments']]])
		assert.deepEqual(refusals(event(), calendar({ lacking: ['attachments'] })), [])
	})

	it('holds an entry with attachments in a calendar that cannot take them: what is there was the provider\'s own doing', () => {
		const attached = event({ attachments: EntryFiles.of([{ sourceUrl: 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456' }]) })
		assert.deepEqual(refusals(attached, calendar({ cannot: { attach: false } })), [])
	})
})

describe('Entry.canMoveTo', () => {
	const away = (init: Parameters<typeof calendar>[0] = {}) => Object.assign(calendar({ id: 'away', ...init }), { enabled: true })

	it('moves into another enabled calendar that takes new entries and refuses nothing it carries', () => {
		assert.equal(event().canMoveTo(away()), true)
		assert.equal(event().canMoveTo(Object.assign(calendar(), { enabled: true })), false, 'not into its own')
		assert.equal(event().canMoveTo(calendar({ id: 'away' })), false, 'not into a disabled one')
		assert.equal(event().canMoveTo(away({ cannot: { create: false } })), false)
		assert.equal(event({ visibility: Visibility.Private }).canMoveTo(away({ lacking: ['visibility'] })), false)
	})

	it('changes its type on the way where it must, unless it repeats', () => {
		assert.equal(event().canMoveTo(away({ types: [EntryType.Task] })), true)
		assert.equal(event({ recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) }).canMoveTo(away({ types: [EntryType.Task] })), false)
	})

	it('lets one occurrence leave its rule behind into a calendar that holds none, never the whole series', () => {
		const repeating = event({ recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		assert.equal(repeating.canMoveTo(away({ lacking: ['recurrence'] })), false)
		assert.equal(repeating.canMoveTo(away({ lacking: ['recurrence'] }), { occurrence: true }), true)
	})
})

describe('EntryPatch.validate', () => {
	it('lets a calendar that cannot be written refuse a new entry', () => {
		assert.deepEqual(described(patch({ heading: 'Talk' }).validate({ to: calendar({ cannot: { create: false } }) })), [['This calendar cannot be written to from mitra', []]])
	})

	describe('attachments where the calendar cannot take them', () => {
		const drive = () => EntryFiles.of([{ sourceUrl: 'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456' }])
		const google = () => calendar({ cannot: { attach: false } })

		it('refuses a change of the files, and nothing else', () => {
			const entry = event({ attachments: drive() })
			assert.deepEqual(described(patch({ files: EntryFiles.of([]) }).validate({ entry, to: google() })), [['Attachments in this calendar cannot be changed from mitra', ['files']]])
			assert.deepEqual(described(patch({ files: null }).validate({ entry, to: google() })), [['Attachments in this calendar cannot be changed from mitra', ['files']]])
			assert.deepEqual(described(patch({ files: drive() }).validate({ entry, to: google() })), [])
			assert.deepEqual(described(patch({ heading: 'Renamed' }).validate({ entry, to: google() })), [])
		})

		it('refuses creating an entry with files there', () => {
			assert.deepEqual(described(patch({ heading: 'Talk', files: drive() }).validate({ to: google() })), [['This calendar does not take attachments', ['files']]])
			assert.deepEqual(described(patch({ heading: 'Talk' }).validate({ to: google() })), [])
		})

		it('refuses moving an entry with files there', () => {
			const entry = event({ attachments: drive() })
			assert.deepEqual(described(patch({ sourceId: 'google' }).validate({ entry, from: calendar(), to: calendar({ id: 'google', cannot: { attach: false } }) })), [['This calendar does not take attachments', ['sourceId']]])
			assert.deepEqual(described(patch({ sourceId: 'google' }).validate({ entry: event(), from: calendar(), to: calendar({ id: 'google', cannot: { attach: false } }) })), [])
		})
	})

	it('refuses a new title where the provider owns it, but not the same one', () => {
		const home = calendar({ cannot: { rename: false } })
		assert.deepEqual(described(patch({ heading: 'Keynote' }).validate({ entry: event(), to: home })), [['Entries in this calendar take their title from the provider and cannot be renamed', ['heading']]])
		assert.deepEqual(described(patch({ heading: 'Talk' }).validate({ entry: event(), to: home })), [])
	})

	it('refuses to take an event\'s start, which RFC 5545 requires', () => {
		assert.deepEqual(described(patch({ start: null }).validate({ entry: event(), to: calendar() })), [['An event must have a date', ['start']]])
		assert.deepEqual(described(patch({ start: null }).validate({ entry: event({ type: EntryType.Task }), to: calendar() })), [])
	})

	it('keeps the date a rule repeats from, unless one occurrence leaves', () => {
		const weekly = event({ recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
		for (const scope of [EntryOccurrenceChangeScope.All, EntryOccurrenceChangeScope.Following]) {
			assert.deepEqual(described(patch({ start: null }).validate({ entry: weekly, to: calendar(), scope })), [
				['An event must have a date', ['start']],
				['A repeating entry cannot lose the date it repeats from', ['start']],
			])
		}
		const rent = new Entry({ id: 'r', sourceId: 'home', type: EntryType.Task, heading: 'Pay the rent', due: start, recurrence: new Recurrence({ freq: RecurrenceFrequency.Monthly }) })
		assert.deepEqual(described(patch({ due: null }).validate({ entry: rent, to: calendar(), scope: EntryOccurrenceChangeScope.All })), [['A repeating entry cannot lose the date it repeats from', ['due']]])
		assert.deepEqual(described(patch({ start: null }).validate({ entry: weekly, to: calendar(), scope: EntryOccurrenceChangeScope.This })), [['An event must have a date', ['start']]])
	})

	it('keeps a recurring entry\'s type, and its rule out of a calendar without one, unless one occurrence leaves', () => {
		const weekly = event({ recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
		assert.deepEqual(described(patch({ type: EntryType.Task }).validate({ entry: weekly, to: calendar() })), [['A recurring entry cannot change its type', ['type']]])
		const away = calendar({ id: 'away', lacking: ['recurrence'] })
		assert.deepEqual(described(patch({ sourceId: 'away' }).validate({ entry: weekly, from: calendar(), to: away })), [['This calendar cannot hold a repeating entry', ['recurrence']]])
		assert.deepEqual(described(patch({ sourceId: 'away' }).validate({ entry: weekly, from: calendar(), to: away, scope: EntryOccurrenceChangeScope.This })), [])
	})
})
