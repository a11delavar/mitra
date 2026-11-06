import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../Entry.js'
import { EntryStatus } from '../EntryStatus.js'
import { EntryType } from '../EntryType.js'
import { EntryEditorIntent } from './EntryEditorIntent.js'
import { EntryStore } from './EntryStore.js'
import { HideCancelledSetting } from './HideCancelledSetting.js'

describe('HideCancelledSetting', () => {
	const day = new DateTime().dayStart

	const entry = (id: string, type: EntryType, status?: EntryStatus) => new Entry({
		id, sourceId: 's', type, heading: id, status,
		start: day.add({ hours: 9 }), end: day.add({ hours: 10 }),
	}).occurrences.single

	beforeEach(() => {
		EntryEditorIntent.reset()
		EntryStore.reset()
	})

	it('draws every entry while off, and hands back the very array it was given', () => {
		const entries = [entry('a', EntryType.Task, EntryStatus.Cancelled), entry('b', EntryType.Event, EntryStatus.Cancelled)]
		assert.ok(entries.every(occurrence => HideCancelledSetting.shows(occurrence, false)))
		assert.equal(HideCancelledSetting.filter(entries, false), entries)
	})

	it('drops a cancelled task and a cancelled event alike while on', () => {
		assert.equal(HideCancelledSetting.shows(entry('a', EntryType.Task, EntryStatus.Cancelled), true), false)
		assert.equal(HideCancelledSetting.shows(entry('b', EntryType.Event, EntryStatus.Cancelled), true), false)
	})

	it('keeps a done task, which is the other lens\'s, and whatever is still on', () => {
		assert.equal(HideCancelledSetting.shows(entry('a', EntryType.Task, EntryStatus.Done), true), true)
		assert.equal(HideCancelledSetting.shows(entry('b', EntryType.Task), true), true)
		assert.equal(HideCancelledSetting.shows(entry('c', EntryType.Event), true), true)
		assert.equal(HideCancelledSetting.shows(entry('d', EntryType.Event, EntryStatus.Tentative), true), true)
	})

	it('keeps the entry whose editor is open, so cancelling it there never tears out the editor', () => {
		const open = entry('a', EntryType.Event)
		EntryEditorIntent.setEditing(open.entry, true)
		open.entry.status = EntryStatus.Cancelled
		assert.equal(HideCancelledSetting.shows(open, true), true)
		EntryEditorIntent.setEditing(open.entry, false)
		assert.equal(HideCancelledSetting.shows(open, true), false)
	})

	it('filters a rendered set in the order it arrived, memoized until the lens flips', () => {
		const entries = [entry('a', EntryType.Task, EntryStatus.Cancelled), entry('b', EntryType.Event), entry('c', EntryType.Task, EntryStatus.Done), entry('d', EntryType.Event, EntryStatus.Cancelled)]
		assert.deepEqual(HideCancelledSetting.filter(entries, true).map(occurrence => occurrence.key), ['b', 'c'])
		assert.equal(HideCancelledSetting.filter(entries, true), HideCancelledSetting.filter(entries, true))
		assert.equal(HideCancelledSetting.filter(entries, false), entries)
		assert.equal(HideCancelledSetting.filter(entries, true).length, 2)
	})
})
