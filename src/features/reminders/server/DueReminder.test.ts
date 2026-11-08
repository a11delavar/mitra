import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryPatch, EntryType } from '#features/entries'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'
import { EntryReminders } from '../EntryReminders.js'
import { DueReminder } from '../Reminders.js'

describe('DueReminder.of', () => {
	let server: OperationServer
	before(async () => server = await OperationServer.start())
	after(() => server.close())

	const em = async () => (await import('#infrastructure/database/orm.js')).orm.em.fork()
	const create = (heading: string, start: DateTime, minutes: number) =>
		CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: server.source.id, type: EntryType.Event, heading, start, end: start.add({ minutes: 30 }), reminders: EntryReminders.normalize([minutes]) })))

	it('reads the user\'s reminders due in the window', async () => {
		const now = new Date()
		const soon = new DateTime(now.getTime() + 20 * 60_000)
		await create('Standup', soon, 15)
		await create('Review', soon.add({ hours: 3 }), 15)

		const due = await DueReminder.of(await em(), server.user, new Date(now.getTime() - 60_000), new Date(now.getTime() + 10 * 60_000))
		assert.deepEqual(due.map(reminder => [reminder.occurrence.entry.heading, reminder.minutes]), [['Standup', 15]])
	})
})
