import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType } from '#features/entries'
import { EntryReminders } from './EntryReminders.js'
import { ReminderDefaults } from './ReminderDefaults.js'

describe('ReminderDefaults', () => {
	const defaults = new ReminderDefaults(30, 0)
	// A day of 24 hours, as the tests add hours to it.
	const day = new DateTime('2026-10-14T00:00:00')
	const timed = (type: EntryType) => new Entry({ type, start: day.add({ hours: 10 }), end: day.add({ hours: 11 }) })

	afterEach(() => ReminderDefaults.from(undefined))

	it('gives each kind its own, where a time anchors them', () => {
		assert.deepEqual(defaults.for(timed(EntryType.Event)), EntryReminders.normalize([30]))
		assert.deepEqual(defaults.for(timed(EntryType.Task)), EntryReminders.normalize([0]))
		assert.equal(new ReminderDefaults(null, 0).for(timed(EntryType.Event)), undefined)
	})

	it('gives none to a day, to availability and to a task with no time', () => {
		assert.equal(defaults.for(new Entry({ type: EntryType.Event, start: day, end: day.add({ days: 1 }), allDay: true })), undefined)
		assert.equal(defaults.for(timed(EntryType.Availability)), undefined)
		assert.equal(defaults.for(new Entry({ type: EntryType.Task })), undefined)
	})

	it('lets reminders still on the account\'s defaults follow a change of kind', () => {
		ReminderDefaults.from(() => defaults)
		const entry = timed(EntryType.Event)
		entry.reminders = defaults.for(entry)
		entry.type = EntryType.Task
		assert.deepEqual(entry.reminders, EntryReminders.normalize([0]))
	})

	it('keeps the user\'s own across a change of kind', () => {
		ReminderDefaults.from(() => defaults)
		const entry = timed(EntryType.Event)
		entry.reminders = EntryReminders.normalize([5])
		entry.type = EntryType.Task
		assert.deepEqual(entry.reminders, EntryReminders.normalize([5]))
	})

	it('changes nothing where none are registered, as on the server', () => {
		const entry = timed(EntryType.Event)
		entry.reminders = EntryReminders.normalize([30])
		entry.type = EntryType.Task
		assert.deepEqual(entry.reminders, EntryReminders.normalize([30]))
	})
})
