import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from '@a11d/api'
import { DateTime } from '@3mo/date-time'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { updateEvent } from './Api.js'

describe('updateEvent', () => {
	const put = Api.put
	afterEach(() => Api.put = put)

	/** The body the entry's update sends. */
	const sent = (entry: Entry) => {
		let body: Partial<Record<keyof Entry, unknown>> | undefined
		Api.put = ((_url: string, payload: typeof body) => {
			body = payload
			return Promise.resolve(entry)
		}) as typeof Api.put
		void updateEvent(entry)
		return body!
	}

	const start = new DateTime('2026-10-05T09:00:00')
	const task = (init?: Partial<Entry>) => new Entry({ id: 't', sourceId: 's', type: EntryType.Task, heading: 'Report', start, end: start.add({ hours: 1 }), ...init })

	it('sends a removed due date as null: an absent one is the stored one to the server, so the due date came back', () => {
		const entry = task({ due: start.add({ days: 2 }) })
		entry.due = undefined
		assert.equal(sent(entry).due, null)
	})

	it('sends removed dates as null, and the dates it has as they are', () => {
		const due = start.add({ days: 2 })
		assert.equal(sent(task({ due })).due, due)
		const unscheduled = task({ due })
		unscheduled.unschedule()
		const body = sent(unscheduled)
		assert.equal(body.start, null)
		assert.equal(body.end, null)
		assert.equal(body.due, due)
	})
})
