import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryReminders } from './EntryReminders.js'

describe('EntryReminders', () => {
	it('holds each once, in order, and none rather than an empty list', () => {
		assert.deepEqual([...EntryReminders.normalize([30, 5, 30])!], [5, 30])
		assert.equal(EntryReminders.normalize([]), undefined)
		assert.equal(EntryReminders.normalize(null), undefined)
	})

	it('adds and takes one away, none once the last goes', () => {
		const reminders = EntryReminders.normalize([30])!
		assert.deepEqual([...reminders.adding(5)!], [5, 30])
		assert.deepEqual([...reminders.adding(30)!], [30])
		assert.equal(reminders.without(30), undefined)
	})

	it('names how far ahead the first fires', () => {
		assert.equal(EntryReminders.normalize([0, 1440, 30])!.earliest, 1440)
	})

	it('stays itself through a copy, as an entry copies it', () => {
		assert.ok(EntryReminders.from([...EntryReminders.normalize([30])!]) instanceof EntryReminders)
	})
})
