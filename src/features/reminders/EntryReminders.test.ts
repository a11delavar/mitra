import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryReminders } from './EntryReminders.js'

describe('EntryReminders', () => {
	it('holds each once, in order, and none rather than an empty list', () => {
		assert.deepEqual(EntryReminders.normalize([30, 5, 30])?.map(({ minutes }) => minutes), [5, 30])
		assert.equal(EntryReminders.normalize([]), undefined)
		assert.equal(EntryReminders.normalize(null), undefined)
	})

	it('adds and takes one away, none once the last goes', () => {
		const reminders = EntryReminders.normalize([30])!
		assert.deepEqual(reminders.adding(5)?.map(({ minutes }) => minutes), [5, 30])
		assert.deepEqual(reminders.adding(30)?.map(({ minutes }) => minutes), [30])
		assert.equal(reminders.without(30), undefined)
	})

	it('names how far ahead the first fires', () => {
		assert.equal(EntryReminders.normalize([0, 1440, 30])!.earliest, 1440)
	})

	it('sends one by email and back, written as `{ minutes, email: true }`', () => {
		const reminders = EntryReminders.normalize([5, 30])!.toggled(30)!
		assert.deepEqual(EntryReminders.converter.deconstruct!(reminders, {}), [5, { minutes: 30, email: true }])
		assert.deepEqual(EntryReminders.converter.construct!([5, { minutes: 30, email: true }], {}), reminders)
		assert.deepEqual(reminders.toggled(30), EntryReminders.normalize([5, 30]))
	})

	it('stays itself through a copy, as an entry copies it', () => {
		assert.ok(EntryReminders.from([...EntryReminders.normalize([30])!]) instanceof EntryReminders)
	})
})
