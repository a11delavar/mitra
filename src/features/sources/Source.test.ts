import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Source } from './Source.js'
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
		const wireClone = structuredClone(managed) // loses the class, the getter, everything but data
		assert.equal((wireClone as { key?: string }).key, undefined) // the getter is gone — this was the trap
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

	// RFC 4791 §5.2.3: an absent supported-calendar-component-set accepts everything. Same reading for a
	// row written before the column existed (its `kinds` hydrates as null).
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

	// The list is stored as value objects and carried as plain ones, which is EntryTypes.converter's
	// whole job — and the API's request builder structure-clones, stripping every prototype on the way.
	describe('crossing the API', () => {
		it('travels as plain values and arrives as value objects again', () => {
			const both = source([EntryType.Event, EntryType.Task])

			assert.deepEqual(wireOf(both).entryTypes, ['event', 'task'])
			assert.deepEqual([...revive<Source>(wireOf(both)).entryTypes], [EntryType.Event, EntryType.Task])
		})

		it('sends a list it never learned as empty rather than dropping the key', () => {
			// A row written before the column existed, whose NULL the driver may hand straight over — every
			// consumer reads `[]` as "accept everything", while a missing key would leave the client guessing.
			const unknowing = Object.assign(source(), { entryTypes: null })

			assert.deepEqual(wireOf(unknowing).entryTypes, [])
			assert.deepEqual([...revive<Source>(wireOf(unknowing)).entryTypes], [])
		})
	})
})
