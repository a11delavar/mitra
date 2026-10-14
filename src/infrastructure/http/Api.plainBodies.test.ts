import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { wireOf, revive } from '../model/wire.testing.js'
import { editOccurrence, updateEvent } from './Api.js'
import { Entry } from '../../features/entries/Entry.js'
import { TaskStatus } from '../../features/entries/TaskStatus.js'
import { Transparency } from '../../features/entries/Transparency.js'
import { Visibility } from '../../features/entries/Visibility.js'
import { EntryTimeZone } from '../../features/entries/EntryTimeZone.js'

// An occurrence's edits travel as plain bodies, which no converter runs on: their value objects must still arrive as codes.
describe('Plain entry bodies', () => {
	const put = Api.put
	afterEach(() => Api.put = put)

	/** The body a call sends, as the server's reviver and `Entry.reviveValues` read it. */
	const received = async (send: () => Promise<unknown>) => {
		let body: unknown
		Api.put = ((_url: string, sent: unknown) => Promise.resolve(body = sent)) as typeof Api.put
		await send()
		return Entry.reviveValues(revive<Partial<Entry>>(wireOf(body)))
	}
	const occurrence = () => new Entry({
		id: 'series__1', recurringEntryId: 'series', recurrenceId: new Date('2026-10-06T07:00:00Z') as never, heading: 'Standup',
		status: TaskStatus.Done, transparency: Transparency.Free, visibility: Visibility.Private, timeZone: EntryTimeZone.parse('Asia/Tehran'),
	})

	it('carry an occurrence\'s status, busy/free, visibility and time zone through a scoped edit', async () => {
		const body = await received(() => editOccurrence(occurrence(), 'this'))
		assert.deepEqual([body.status, body.transparency, body.visibility, body.timeZone], [TaskStatus.Done, Transparency.Free, Visibility.Private, EntryTimeZone.parse('Asia/Tehran')])
	})

	it('carry busy/free, visibility and time zone through an edit of the whole series', async () => {
		const body = await received(() => updateEvent(occurrence()))
		assert.deepEqual([body.transparency, body.visibility, body.timeZone], [Transparency.Free, Visibility.Private, EntryTimeZone.parse('Asia/Tehran')])
	})
})
