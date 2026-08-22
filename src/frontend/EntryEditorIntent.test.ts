import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../shared/Entry.js'
import { EntryType } from '../shared/EntryType.js'
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
})
