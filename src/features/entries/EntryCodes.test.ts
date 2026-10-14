import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'
import { TaskStatus } from './TaskStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

// RFC 5545's STATUS, TRANSP and CLASS: one instance per code, sent and stored as the code.
describe('Entry codes', () => {
	const codes = [
		[TaskStatus, TaskStatus.all, ['todo', 'doing', 'done', 'cancelled']],
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
		assert.deepEqual(TaskStatus.all.map(status => String(status.format())), ['To Do', 'Doing', 'Done', 'Cancelled'])
		assert.deepEqual(TaskStatus.all.map(status => status.icon), ['square', 'square-minus', 'square-check-big', 'square-x'])
		assert.deepEqual(TaskStatus.all.map(status => status.closed), [false, false, true, true])
		assert.deepEqual(Transparency.all.map(transparency => String(transparency.format())), ['Busy', 'Free'])
		assert.deepEqual(Visibility.all.map(visibility => String(visibility.format())), ['Public', 'Private', 'Confidential'])
	})

	it('keeps the codes in the database', () => {
		const status = new TaskStatus.Mapper()
		assert.equal(status.convertToDatabaseValue(TaskStatus.Done), 'done')
		assert.equal(status.convertToJSValue('done'), TaskStatus.Done)
		assert.equal(status.convertToJSValue(null), null)
		assert.equal(new Transparency.Mapper().convertToJSValue('free'), Transparency.Free)
		assert.equal(new Visibility.Mapper().convertToDatabaseValue(Visibility.Private), 'private')
		assert.equal(new Visibility.Mapper().convertToDatabaseValue(null), null)
	})

	it('crosses the wire as the codes and arrives as the instances', () => {
		const entry = new Entry({ type: EntryType.Task, heading: 'Report', status: TaskStatus.Done, visibility: Visibility.Private })
		const wire = wireOf(entry)
		assert.deepEqual([wire.status, 'transparency' in wire, wire.visibility], ['done', false, 'private'])
		const revived = revive<Entry>(wire)
		assert.equal(revived.status, TaskStatus.Done)
		assert.equal(revived.visibility, Visibility.Private)
		assert.equal(revived.transparency, undefined)
	})
})
