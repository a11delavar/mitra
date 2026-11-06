import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../Entry.js'
import { EntryStatus } from '../EntryStatus.js'
import { EntryType } from '../EntryType.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { EntryStore } from './EntryStore.js'
import { HideDoneTasksSetting } from './HideDoneTasksSetting.js'

describe('HideDoneTasksSetting', () => {
	const day = new DateTime().dayStart

	const task = (id: string, status?: EntryStatus) => new Entry({
		id, sourceId: 's', type: EntryType.Task, heading: id, status,
		start: day.add({ hours: 9 }), end: day.add({ hours: 10 }),
	}).occurrences.single

	const event = (id: string, status?: EntryStatus) => new Entry({
		id, sourceId: 's', type: EntryType.Event, heading: id, status,
		start: day.add({ hours: 9 }), end: day.add({ hours: 10 }),
	}).occurrences.single

	beforeEach(() => {
		EntryEditorIntent.reset()
		EntryStore.reset()
	})

	describe('while the lens is off', () => {
		it('draws every entry, done tasks included', () => {
			for (const entry of [task('a', EntryStatus.Done), task('b', EntryStatus.Cancelled), task('c'), event('d')]) {
				assert.equal(HideDoneTasksSetting.shows(entry, false), true)
			}
		})

		it('hands back the very array it was given, so the layout caches keyed on it keep hitting', () => {
			const entries = [task('a', EntryStatus.Done), event('b')]
			assert.equal(HideDoneTasksSetting.filter(entries, false), entries)
		})
	})

	describe('while the lens is on', () => {
		it('drops a done task', () => {
			assert.equal(HideDoneTasksSetting.shows(task('a', EntryStatus.Done), true), false)
		})

		it('keeps a cancelled task, which is the other lens\'s, and a task still in play', () => {
			assert.equal(HideDoneTasksSetting.shows(task('a', EntryStatus.Cancelled), true), true)
			assert.equal(HideDoneTasksSetting.shows(task('b', EntryStatus.ToDo), true), true)
			assert.equal(HideDoneTasksSetting.shows(task('c', EntryStatus.Doing), true), true)
			assert.equal(HideDoneTasksSetting.shows(task('d'), true), true)
		})

		it('never touches an event, which is never done', () => {
			assert.equal(HideDoneTasksSetting.shows(event('a'), true), true)
			assert.equal(HideDoneTasksSetting.shows(event('b', EntryStatus.Cancelled), true), true)
		})

		it('keeps the entry the palette is about to open, so the hit is never a silent no-op', () => {
			const done = task('a', EntryStatus.Done)
			assert.equal(HideDoneTasksSetting.shows(done, true), false)
			EntryEditorIntent.requestOpen('a')
			assert.equal(HideDoneTasksSetting.shows(done, true), true)
		})

		it('keeps the entry whose editor is open, so ticking it there never tears out the editor', () => {
			const open = task('a')
			EntryEditorIntent.setEditing(open.entry, true)
			open.entry.status = EntryStatus.Done
			assert.equal(HideDoneTasksSetting.shows(open, true), true)
			EntryEditorIntent.setEditing(open.entry, false)
			assert.equal(HideDoneTasksSetting.shows(open, true), false)
		})
	})

	describe('filtering a rendered set', () => {
		it('leaves everything but the done tasks, in the order they arrived', () => {
			const entries = [task('a', EntryStatus.Done), event('b'), task('c'), task('d', EntryStatus.Cancelled)]
			assert.deepEqual(HideDoneTasksSetting.filter(entries, true).map(occurrence => occurrence.key), ['b', 'c', 'd'])
		})

		it('answers the same array twice without recomputing it', () => {
			const entries = [task('a', EntryStatus.Done), event('b')]
			assert.equal(HideDoneTasksSetting.filter(entries, true), HideDoneTasksSetting.filter(entries, true))
		})

		it('recomputes when the lens flips, rather than serving the memo of the other answer', () => {
			const entries = [task('a', EntryStatus.Done), event('b')]
			assert.equal(HideDoneTasksSetting.filter(entries, true).length, 1)
			assert.equal(HideDoneTasksSetting.filter(entries, false), entries)
			assert.equal(HideDoneTasksSetting.filter(entries, true).length, 1)
		})
	})
})
