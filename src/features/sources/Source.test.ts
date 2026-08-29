import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Source } from './Source.js'
import { CalDAV } from '../../integrations/caldav/CalDAV.js'
import { IcsSubscription } from '../../integrations/ics/IcsSubscription.js'
import { EntryType } from '../entries/EntryType.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

describe('Source.keyOf', () => {
	it('is the collection URL alone — one collection is ONE source, whatever types it holds', () => {
		const source = new Source({ uri: 'https://dav/cal/', entryTypes: [EntryType.Event, EntryType.Task], name: 'X' })
		assert.equal(source.uri, 'https://dav/cal/')
	})

	// The enable-on-save bug: `@a11d/api` structure-clones request bodies, so incoming sources reach the
	// backend as plain objects with no `key` getter. `applyAndSync` keys them via `keyOf`, which must
	// produce the SAME key as the managed row's getter — otherwise nothing matches and all sources disable.
	it('keys a structure-cloned plain object identically to the managed instance', () => {
		const managed = new Source({ uri: 'https://dav/cal/', entryTypes: [EntryType.Event], name: 'X', enabled: true })
		const wireClone = structuredClone(managed)
		assert.equal((wireClone as { key?: string }).key, undefined)
	})
})

describe('Source entry types', () => {
	const source = (kinds?: Array<EntryType>) => new Source({ uri: 'https://dav/cal/', name: 'X', ...kinds ? { entryTypes: kinds } : {} })

	it('supports exactly what it declares', () => {
		const events = source([EntryType.Event])
		assert.equal(events.supportsEntryType(EntryType.Event), true)
		assert.equal(events.supportsEntryType(EntryType.Task), false)
		const tasks = source([EntryType.Task])
		assert.equal(tasks.supportsEntryType(EntryType.Event), false)
		assert.equal(tasks.supportsEntryType(EntryType.Task), true)
	})

	it('reads an unknown or empty list as "everything"', () => {
		for (const kinds of [undefined, [] as Array<EntryType>, null as unknown as Array<EntryType>]) {
			const unknown = new Source({ uri: 'https://dav/cal/', name: 'X', entryTypes: kinds as Array<EntryType> })
			assert.equal(unknown.supportsEntryType(EntryType.Event), true)
			assert.equal(unknown.supportsEntryType(EntryType.Task), true)
		}
	})

	it('defaults new entries to events wherever it can hold one — mitra is calendar-first', () => {
		assert.equal(source([EntryType.Event, EntryType.Task]).defaultEntryType, EntryType.Event)
		assert.equal(source([EntryType.Event]).defaultEntryType, EntryType.Event)
		assert.equal(source([EntryType.Task]).defaultEntryType, EntryType.Task)
		assert.equal(source([]).defaultEntryType, EntryType.Event)
	})

	describe('crossing the API', () => {
		it('travels as plain values and arrives as value objects again', () => {
			const both = source([EntryType.Event, EntryType.Task])

			assert.deepEqual(wireOf(both).entryTypes, ['event', 'task'])
			assert.deepEqual([...revive<Source>(wireOf(both)).entryTypes], [EntryType.Event, EntryType.Task])
		})

		it('sends a list it never learned as empty rather than dropping the key', () => {
			const unknowing = Object.assign(source(), { entryTypes: null })

			assert.deepEqual(wireOf(unknowing).entryTypes, [])
			assert.deepEqual([...revive<Source>(wireOf(unknowing)).entryTypes], [])
		})
	})
})

describe('Source.readOnly narrows what may be written to one calendar', () => {
	const shared = new Source({ uri: 'https://dav/shared/', name: 'Shared with me', readOnly: true })
	const own = new Source({ uri: 'https://dav/mine/', name: 'Mine' })

	it('takes every write away from a read-only calendar, and nothing else', () => {
		const capabilities = new CalDAV().capabilitiesFor(shared)

		assert.deepEqual(
			[capabilities.createEntries, capabilities.editEntries, capabilities.deleteEntries, capabilities.renameEntries],
			[false, false, false, false],
		)
		for (const field of ['recurrence', 'reminders', 'location', 'participants', 'timeZone', 'relations'] as const) {
			assert.equal(capabilities[field], true, `${field} should be unaffected`)
		}
	})

	it('leaves a calendar of your own exactly as the provider left it', () => {
		assert.equal(new CalDAV().capabilitiesFor(own).editEntries, true)
		assert.equal(new CalDAV().capabilitiesFor(new Source({ uri: 'u', name: 'n', readOnly: null })).editEntries, true)
		assert.equal(new CalDAV().capabilitiesFor(undefined).editEntries, true)
	})

	it('cannot promote a provider that already refuses writes', () => {
		assert.equal(new IcsSubscription().capabilitiesFor(own).editEntries, false)
	})
})
