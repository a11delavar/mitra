import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from './Entry.js'
import { EntryPatch } from './EntryPatch.js'
import { EntryType } from './EntryType.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { Source } from '../sources/Source.js'
import { type Calendar } from '../sources/Calendar.js'
import { Recurrence } from '../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../recurrence/RecurrenceFrequency.js'
import { IntegrationCapabilities } from '../../integrations/IntegrationCapabilities.js'
import { type OwnedField } from '../../integrations/IntegrationOwnership.js'
import { CalDAV } from '../../integrations/caldav/CalDAV.js'
import { type ValidationError } from '../../infrastructure/validation/ValidationError.js'

/** A calendar holding `types`, whose integration holds every field but `lacking` and may not do `cannot`. */
const calendar = (init: { id?: string, types?: Array<EntryType>, lacking?: Array<OwnedField>, cannot?: Partial<IntegrationCapabilities['entries']> } = {}): Calendar => {
	const integration = new class extends CalDAV {
		override get capabilities() { return new IntegrationCapabilities({ entries: init.cannot }) }
		override get ownership() { return super.ownership.without(...init.lacking ?? []) }
	}()
	return { source: new Source({ id: init.id ?? 'home', uri: init.id ?? 'home', entryTypes: init.types ?? [EntryType.Event, EntryType.Task], name: 'Home' }), integration }
}
const described = (errors: Iterable<ValidationError>) => [...errors].map(error => [error.message, error.fields])
const start = new DateTime('2026-10-05T09:00:00Z')
const event = (init?: Partial<Entry>) => new Entry({ id: 'e', sourceId: 'home', type: EntryType.Event, heading: 'Talk', start, end: start.add({ hours: 1 }), ...init })
const patch = (init: Partial<EntryPatch>) => Object.assign(new EntryPatch(), init)

describe('Entry.validate', () => {
	it('finds nothing wrong with an entry the calendar can store', () => {
		assert.deepEqual(described(event({ transparency: Transparency.Free, visibility: Visibility.Private }).validate(calendar())), [])
	})

	it('names every fact the calendar cannot store, each with its field', () => {
		const task = new Entry({ type: EntryType.Task, heading: 'Report', visibility: Visibility.Private, percentComplete: 0, due: start, participants: [{ email: 'organizer@example.com', organizer: true }] })
		assert.deepEqual(described(task.validate(calendar({ lacking: ['participants', 'visibility', 'percentComplete', 'due'] }))), [
			['This calendar does not support participants', ['participants']],
			['This calendar does not support visibility', ['visibility']],
			['This calendar does not support task progress', ['percentComplete']],
			['This calendar does not support due dates', ['due']],
		])
		assert.deepEqual(described(event({ transparency: Transparency.Free }).validate(calendar({ lacking: ['transparency'] }))), [['This calendar cannot mark an entry as free', ['transparency']]])
	})

	it('names a type the calendar cannot hold', () => {
		assert.deepEqual(described(event().validate(calendar({ types: [EntryType.Task] }))), [['This calendar cannot hold events', ['type']]])
	})
})

describe('EntryPatch.validate', () => {
	it('lets a calendar that cannot be written refuse a new entry', () => {
		assert.deepEqual(described(patch({ heading: 'Talk' }).validate({ to: calendar({ cannot: { create: false } }) })), [['This calendar cannot be written to from mitra', []]])
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
		for (const scope of ['all', 'following'] as const) {
			assert.deepEqual(described(patch({ start: null }).validate({ entry: weekly, to: calendar(), scope })), [
				['An event must have a date', ['start']],
				['A repeating entry cannot lose the date it repeats from', ['start']],
			])
		}
		const rent = new Entry({ id: 'r', sourceId: 'home', type: EntryType.Task, heading: 'Pay the rent', due: start, recurrence: new Recurrence({ freq: RecurrenceFrequency.Monthly }) })
		assert.deepEqual(described(patch({ due: null }).validate({ entry: rent, to: calendar(), scope: 'all' })), [['A repeating entry cannot lose the date it repeats from', ['due']]])
		assert.deepEqual(described(patch({ start: null }).validate({ entry: weekly, to: calendar(), scope: 'this' })), [['An event must have a date', ['start']]])
	})

	it('keeps a recurring entry\'s type, and its rule out of a calendar without one, unless one occurrence leaves', () => {
		const weekly = event({ recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }) })
		assert.deepEqual(described(patch({ type: EntryType.Task }).validate({ entry: weekly, to: calendar() })), [['A recurring entry cannot change its type', ['type']]])
		const away = calendar({ id: 'away', lacking: ['recurrence'] })
		assert.deepEqual(described(patch({ sourceId: 'away' }).validate({ entry: weekly, from: calendar(), to: away })), [['This calendar cannot hold a repeating entry', ['recurrence']]])
		assert.deepEqual(described(patch({ sourceId: 'away' }).validate({ entry: weekly, from: calendar(), to: away, scope: 'this' })), [])
	})
})
