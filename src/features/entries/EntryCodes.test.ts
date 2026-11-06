import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { revive, wireOf } from '#infrastructure/model/wire.testing.js'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'
import { EntryStatus } from './EntryStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'

// RFC 5545's STATUS, TRANSP and CLASS: one instance per code, sent and stored as the code.
describe('Entry codes', () => {
	const codes = [
		[EntryStatus, EntryStatus.all, ['todo', 'doing', 'done', 'confirmed', 'tentative', 'cancelled']],
		[Transparency, Transparency.all, ['busy', 'free']],
		[Visibility, Visibility.all, ['public', 'private', 'confidential']],
	] as const

	it('reads each code as its one instance, and anything else as none', () => {
		for (const [Code, all, names] of codes) {
			assert.deepEqual(all.map(String), names)
			for (const value of all) {
				assert.equal(Code.parse(value.code), value)
				assert.equal(Code.parse(value), value)
			}
			assert.equal(Code.parse('DONE'), undefined)
			assert.equal(Code.parse(undefined), undefined)
		}
	})

	it('names and draws each status, and closes only done and cancelled', () => {
		assert.deepEqual(EntryStatus.all.map(status => String(status.format())), ['To Do', 'Doing', 'Done', 'Confirmed', 'Maybe', 'Cancelled'])
		assert.deepEqual(EntryStatus.forType(EntryType.Task).map(status => status.iconFor(EntryType.Task)), ['square', 'square-minus', 'square-check-big', 'square-x'])
		assert.deepEqual(EntryStatus.forType(EntryType.Event).map(status => status.iconFor(EntryType.Event)), ['calendar', 'calendar-clock', 'calendar-x'])
		assert.deepEqual(EntryStatus.all.map(status => status.closed), [false, false, true, false, false, true])
		assert.deepEqual(Transparency.all.map(transparency => String(transparency.format())), ['Busy', 'Free'])
		assert.deepEqual(Visibility.all.map(visibility => String(visibility.format())), ['Public', 'Private', 'Confidential'])
	})

	it('gives a task and an event their own statuses, cancelled to both, and availability none', () => {
		assert.deepEqual(EntryStatus.forType(EntryType.Task), [EntryStatus.ToDo, EntryStatus.Doing, EntryStatus.Done, EntryStatus.Cancelled])
		assert.deepEqual(EntryStatus.forType(EntryType.Event), [EntryStatus.Confirmed, EntryStatus.Tentative, EntryStatus.Cancelled])
		assert.deepEqual(EntryStatus.forType(EntryType.Availability), [])
		assert.equal(EntryStatus.Done.appliesTo(EntryType.Event), false)
		assert.equal(EntryStatus.Cancelled.appliesTo(undefined), false)
	})

	it('keeps the codes in the database', () => {
		const status = new EntryStatus.Mapper()
		assert.equal(status.convertToDatabaseValue(EntryStatus.Done), 'done')
		assert.equal(status.convertToJSValue('done'), EntryStatus.Done)
		assert.equal(status.convertToJSValue(null), null)
		assert.equal(new Transparency.Mapper().convertToJSValue('free'), Transparency.Free)
		assert.equal(new Visibility.Mapper().convertToDatabaseValue(Visibility.Private), 'private')
		assert.equal(new Visibility.Mapper().convertToDatabaseValue(null), null)
	})

	it('crosses the wire as the codes and arrives as the instances', () => {
		const entry = new Entry({ type: EntryType.Task, heading: 'Report', status: EntryStatus.Done, visibility: Visibility.Private })
		const wire = wireOf(entry)
		assert.deepEqual([wire.status, 'transparency' in wire, wire.visibility], ['done', false, 'private'])
		const revived = revive<Entry>(wire)
		assert.equal(revived.status, EntryStatus.Done)
		assert.equal(revived.visibility, Visibility.Private)
		assert.equal(revived.transparency, undefined)
	})
})
