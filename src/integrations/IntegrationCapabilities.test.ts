import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TaskStatus } from '#features/entries'
import { IntegrationCapabilities } from './IntegrationCapabilities.js'

describe('IntegrationCapabilities', () => {
	it('takes every write to entries and holds availability, but makes no calendars, unless it says otherwise', () => {
		const capabilities = new IntegrationCapabilities()
		assert.deepEqual(capabilities.entries, { create: true, edit: true, delete: true, rename: true, statuses: TaskStatus.all, attach: true })
		assert.deepEqual(capabilities.sources, { create: false, delete: false })
		assert.equal(capabilities.availability, true)
	})

	it('may hold attachments it cannot take: a provider keeping only its own kind of file, as Google keeps Drive files', () => {
		const google = new IntegrationCapabilities({ entries: { attach: false } })
		assert.deepEqual([google.entries.attach, google.entries.edit], [false, true])
	})

	it('derives without changing what it derives from', () => {
		const base = new IntegrationCapabilities()
		const derived = base.with({ entries: { rename: false }, availability: false })
		assert.deepEqual([derived.entries.rename, derived.entries.create, derived.availability], [false, true, false])
		assert.deepEqual([base.entries.rename, base.availability], [true, true])
	})

	it('can write nothing in a read-only source', () => {
		const readOnly = new IntegrationCapabilities({ sources: { create: true, delete: true } }).in({ readOnly: true })
		assert.deepEqual(readOnly.entries, { create: false, edit: false, delete: false, rename: false, statuses: TaskStatus.all, attach: false })
		assert.deepEqual(readOnly.sources, { create: true, delete: false })
		const writable = new IntegrationCapabilities()
		assert.equal(writable.in({ readOnly: false }), writable)
		assert.equal(writable.in(undefined), writable)
	})
})
