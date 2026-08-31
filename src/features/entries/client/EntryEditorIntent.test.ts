import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { EntryStore } from './EntryStore.js'

describe('EntryEditorIntent', () => {
	const day = new DateTime().dayStart
	const entry = (init?: Partial<Entry>) => new Entry({
		id: 'a', sourceId: 's', type: EntryType.Event, heading: 'Standup', start: day.add({ hours: 9 }), end: day.add({ hours: 10 }), ...init,
	})

	beforeEach(() => {
		EntryEditorIntent.reset()
		EntryStore.reset()
	})

	it('opens nothing until something is requested', () => {
		assert.equal(EntryEditorIntent.shouldOpen(entry()), false)
	})

	describe('a draft', () => {
		it('matches the very instance that was dropped, not another draft', () => {
			const draft = entry({ id: undefined })
			EntryEditorIntent.openDraft(draft)
			assert.equal(EntryEditorIntent.shouldOpen(draft), true)
			assert.equal(EntryEditorIntent.shouldOpen(entry({ id: undefined })), false)
		})

		it('opens once — the second segment of a multi-day draft finds nothing pending', () => {
			const draft = entry({ id: undefined })
			EntryEditorIntent.openDraft(draft)
			EntryEditorIntent.consume()
			assert.equal(EntryEditorIntent.shouldOpen(draft), false)
		})

		it('is left alone by a fetch — a draft is never among the server entries', () => {
			const draft = entry({ id: undefined })
			EntryEditorIntent.openDraft(draft)
			EntryEditorIntent.settle([entry()])
			assert.equal(EntryEditorIntent.shouldOpen(draft), true)
		})
	})

	describe('a picked entry', () => {
		it('matches by id, so it survives the refetch the navigation triggers', () => {
			EntryEditorIntent.requestOpen('a')
			assert.equal(EntryEditorIntent.shouldOpen(entry()), true)
			assert.equal(EntryEditorIntent.shouldOpen(entry({ id: 'b' })), false)
		})

		it('matches a rendered occurrence of the picked series', () => {
			EntryEditorIntent.requestOpen('master')
			assert.equal(EntryEditorIntent.shouldOpen(entry({ id: 'master-2', recurrenceMasterId: 'master' })), true)
		})

		it('is consumed by the segment that opened it', () => {
			EntryEditorIntent.requestOpen('a')
			EntryEditorIntent.consume()
			assert.equal(EntryEditorIntent.shouldOpen(entry()), false)
		})

		it('is kept by a fetch that carries the entry', () => {
			EntryEditorIntent.requestOpen('a')
			EntryEditorIntent.settle([entry({ id: 'b' }), entry()])
			assert.equal(EntryEditorIntent.shouldOpen(entry()), true)
		})

		it('is dropped by a fetch without it, so it can never auto-open a later window', () => {
			EntryEditorIntent.requestOpen('a')
			EntryEditorIntent.settle([entry({ id: 'b' })])
			assert.equal(EntryEditorIntent.shouldOpen(entry()), false)
		})
	})

	describe('an open editor', () => {
		it('holds its entry, and lets go when it closes', () => {
			const open = entry()
			assert.equal(EntryEditorIntent.holds(open), false)
			EntryEditorIntent.setEditing(open, true)
			assert.equal(EntryEditorIntent.holds(open), true)
			EntryEditorIntent.setEditing(open, false)
			assert.equal(EntryEditorIntent.holds(open), false)
		})

		it('holds the same persisted entry under another instance, since a refetch may swap it', () => {
			EntryEditorIntent.setEditing(entry(), true)
			assert.equal(EntryEditorIntent.holds(entry()), true)
			assert.equal(EntryEditorIntent.holds(entry({ id: 'b' })), false)
		})

		it('is not let go by another entry closing its own editor', () => {
			const open = entry()
			EntryEditorIntent.setEditing(open, true)
			EntryEditorIntent.setEditing(entry({ id: 'b' }), false)
			assert.equal(EntryEditorIntent.holds(open), true)
		})

		it('takes the claim over from the request without a gap, so a render between the two never drops it', () => {
			const target = entry()
			EntryEditorIntent.requestOpen('a')
			EntryEditorIntent.setEditing(target, true)
			EntryEditorIntent.consume()
			assert.equal(EntryEditorIntent.holds(target), true)
		})

		it('holds one entry at a time, the last one opened', () => {
			const first = entry()
			const second = entry({ id: 'b' })
			EntryEditorIntent.setEditing(first, true)
			EntryEditorIntent.setEditing(second, true)
			assert.equal(EntryEditorIntent.holds(first), false)
			assert.equal(EntryEditorIntent.holds(second), true)
		})
	})
})
