import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, TaskStatus } from '../Entry.js'
import { EntryType } from '../EntryType.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { EntryStore } from './EntryStore.js'
import { HideDoneTasksSetting } from './HideDoneTasksSetting.js'

describe('HideDoneTasksSetting', () => {
	const day = new DateTime().dayStart

	const task = (id: string, status?: TaskStatus) => new Entry({
		id, sourceId: 's', type: EntryType.Task, heading: id, status,
		start: day.add({ hours: 9 }), end: day.add({ hours: 10 }),
	})

	const event = (id: string) => new Entry({
		id, sourceId: 's', type: EntryType.Event, heading: id,
		start: day.add({ hours: 9 }), end: day.add({ hours: 10 }),
	})

	beforeEach(() => {
		EntryEditorIntent.reset()
		EntryStore.reset()
	})

	describe('while the lens is off', () => {
		it('draws every entry, closed tasks included', () => {
			for (const entry of [task('a', TaskStatus.Done), task('b', TaskStatus.Cancelled), task('c'), event('d')]) {
				assert.equal(HideDoneTasksSetting.shows(entry, false), true)
			}
		})

		it('hands back the very array it was given, so the layout caches keyed on it keep hitting', () => {
			const entries = [task('a', TaskStatus.Done), event('b')]
			assert.equal(HideDoneTasksSetting.filter(entries, false), entries)
		})
	})

	describe('while the lens is on', () => {
		it('drops a done task and a cancelled one — the outcome is decided either way', () => {
			assert.equal(HideDoneTasksSetting.shows(task('a', TaskStatus.Done), true), false)
			assert.equal(HideDoneTasksSetting.shows(task('b', TaskStatus.Cancelled), true), false)
		})

		it('keeps a task still in play', () => {
			assert.equal(HideDoneTasksSetting.shows(task('a', TaskStatus.ToDo), true), true)
			assert.equal(HideDoneTasksSetting.shows(task('b', TaskStatus.Doing), true), true)
			assert.equal(HideDoneTasksSetting.shows(task('c'), true), true)
		})

		it('never touches an event, which has no outcome to decide', () => {
			assert.equal(HideDoneTasksSetting.shows(event('a'), true), true)
		})

		it('keeps the entry the palette is about to open, so the hit is never a silent no-op', () => {
			const done = task('a', TaskStatus.Done)
			assert.equal(HideDoneTasksSetting.shows(done, true), false)
			EntryEditorIntent.requestOpen('a')
			assert.equal(HideDoneTasksSetting.shows(done, true), true)
		})

		it('keeps the entry whose editor is open, so ticking it there never tears out the editor', () => {
			const open = task('a')
			EntryEditorIntent.setEditing(open, true)
			open.status = TaskStatus.Done
			assert.equal(HideDoneTasksSetting.shows(open, true), true)
			EntryEditorIntent.setEditing(open, false)
			assert.equal(HideDoneTasksSetting.shows(open, true), false)
		})
	})

	describe('filtering a rendered set', () => {
		it('leaves the open work and the events, in the order they arrived', () => {
			const entries = [task('a', TaskStatus.Done), event('b'), task('c'), task('d', TaskStatus.Cancelled)]
			assert.deepEqual(HideDoneTasksSetting.filter(entries, true).map(entry => entry.id), ['b', 'c'])
		})

		it('answers the same array twice without recomputing it', () => {
			const entries = [task('a', TaskStatus.Done), event('b')]
			assert.equal(HideDoneTasksSetting.filter(entries, true), HideDoneTasksSetting.filter(entries, true))
		})

		it('recomputes when the lens flips, rather than serving the memo of the other answer', () => {
			const entries = [task('a', TaskStatus.Done), event('b')]
			assert.equal(HideDoneTasksSetting.filter(entries, true).length, 1)
			assert.equal(HideDoneTasksSetting.filter(entries, false), entries)
			assert.equal(HideDoneTasksSetting.filter(entries, true).length, 1)
		})
	})
})
