import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type EntityManager } from '@mikro-orm/core'
import { Entry } from './Entry.js'
import { EntryPatch } from './EntryPatch.js'
import { EntryType } from './EntryType.js'
import { EntryRank } from './EntryRank.js'
import { Source } from '../sources/Source.js'
import { type Calendar } from '../sources/Calendar.js'
import { type Integration } from '../../integrations/Integration.js'

describe('EntryChange', () => {
	const em = { flush: async () => { } } as unknown as EntityManager
	const patchOf = (fields: Partial<EntryPatch>) => Object.assign(new EntryPatch(), fields)
	const task = () => new Entry({ id: 'task', uid: 'task-uid', sourceId: 'here', type: EntryType.Task, heading: 'Report', rank: EntryRank.first })

	/** A calendar recording what was written to it, failing deletes when asked to. */
	const calendar = (id: string, uri: string, { failDelete = false } = {}) => {
		const log = new Array<string>()
		const integration = {
			createEntry: (_em: EntityManager, entry: Entry) => (log.push(`create ${entry.heading}`), Promise.resolve(entry)),
			updateEntry: (_em: EntityManager, _entry: Entry, edited: Entry) => (log.push(`update ${edited.heading}`), Promise.resolve()),
			deleteEntry: (_em: EntityManager, entry: Entry) => {
				if (failDelete) {
					return Promise.reject(new Error('Refused'))
				}
				log.push(`delete ${entry.id}`)
				return Promise.resolve()
			},
		} as unknown as Integration
		return { log, calendar: { source: new Source({ id, uri, name: id, entryTypes: [EntryType.Event, EntryType.Task] }), integration } satisfies Calendar }
	}

	it('updates in place what stays in its calendar and keeps its type', async () => {
		const here = calendar('here', 'https://dav/here/')
		const entry = task()
		const edit = entry.edit(patchOf({ heading: 'Final report' }))
		assert.equal(edit.recreates, false)
		assert.equal(await edit.save(em, here.calendar, here.calendar), entry)
		assert.deepEqual(here.log, ['update Final report'])
	})

	it('re-creates what moves to another calendar, keeping its uid and rank, then deletes the original', async () => {
		const here = calendar('here', 'https://dav/here/')
		const there = calendar('there', 'https://other/there/')
		const entry = task()
		const edit = entry.edit(patchOf({ sourceId: 'there' }))
		assert.equal(edit.recreates, true)
		const saved = await edit.save(em, here.calendar, there.calendar)
		assert.notEqual(saved.id, 'task')
		assert.equal(saved.uid, 'task-uid')
		assert.equal(saved.sourceId, 'there')
		assert.equal(saved.rank, entry.rank)
		assert.deepEqual(there.log, ['create Report'])
		assert.deepEqual(here.log, ['delete task'])
	})

	it('re-creates a task turned into an event, with a fresh uid where both calendars share a server path and without its rank', async () => {
		const here = calendar('here', 'https://dav/shared/')
		const entry = task()
		const saved = await entry.edit(patchOf({ type: EntryType.Event })).save(em, here.calendar, here.calendar)
		assert.notEqual(saved.uid, 'task-uid')
		assert.equal(saved.rank, undefined)
		assert.deepEqual(here.log, ['create Report', 'delete task'])
	})

	it('takes the copy back when the original cannot be deleted', async () => {
		const here = calendar('here', 'https://dav/here/', { failDelete: true })
		const there = calendar('there', 'https://other/there/')
		const deleted = new Array<string>()
		Object.assign(there.calendar.integration, { deleteEntry: (_em: EntityManager, entry: Entry) => (deleted.push(entry.sourceId), Promise.resolve()) })
		await assert.rejects(task().edit(patchOf({ sourceId: 'there' })).save(em, here.calendar, there.calendar), /Refused/)
		assert.deepEqual(deleted, ['there'])
	})
})
