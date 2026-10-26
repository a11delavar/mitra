import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type EntityManager } from '@mikro-orm/core'
import { Source } from '#features/sources'
import { Participants } from '#features/participants/Participant.js'
import { type Integration, IntegrationCapabilities, IntegrationOwnership } from '#integrations'
import { Entry } from './Entry.js'
import { EntryPatch } from './EntryPatch.js'
import { EntryType } from './EntryType.js'
import { EntryRank } from './EntryRank.js'
import { Visibility } from './Visibility.js'

describe('EntryChange', () => {
	const em = { flush: async () => { } } as unknown as EntityManager
	const patchOf = (fields: Partial<EntryPatch>) => Object.assign(new EntryPatch(), fields)

	/** A calendar recording what was written to it, failing deletes when asked to. */
	const calendar = (id: string, uri: string, { failDelete = false, integrationId = id, capabilities = new IntegrationCapabilities() } = {}) => {
		const log = new Array<string>()
		const integration = {
			id: integrationId,
			capabilities,
			ownership: new IntegrationOwnership({ end: 'upstream', estimate: 'upstream', participants: 'upstream' }),
			capabilitiesFor: () => capabilities,
			canHold: (source: Source, type: EntryType) => source.supportsEntryType(type),
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
		return { log, calendar: Object.assign(new Source({ id, uri, name: id, integrationId, entryTypes: [EntryType.Event, EntryType.Task] }), { integration }) }
	}

	const task = (source: Source) => new Entry({ id: 'task', uid: 'task-uid', sourceId: source.id, source, type: EntryType.Task, heading: 'Report', rank: EntryRank.first })

	it('updates in place what stays in its calendar and keeps its type', async () => {
		const here = calendar('here', 'https://dav/here/')
		const entry = task(here.calendar)
		const change = entry.edit(patchOf({ heading: 'Final report' }))
		assert.deepEqual([...change.validate()], [])
		assert.equal(change.recreates, false)
		assert.equal(await change.save(em), entry)
		assert.deepEqual(here.log, ['update Final report'])
	})

	it('moves in place between calendars of a provider that moves its own entries', async () => {
		const capabilities = new IntegrationCapabilities({ entries: { move: true } })
		const here = calendar('here', 'todoist://project/1', { integrationId: 'account', capabilities })
		const there = calendar('there', 'todoist://project/2', { integrationId: 'account', capabilities })
		const entry = task(here.calendar)
		const change = entry.edit(patchOf({ sourceId: 'there' }))
		change.edited.source = there.calendar
		assert.equal(change.to, there.calendar)
		assert.equal(change.recreates, false)
		assert.equal(await change.save(em), entry)
		assert.deepEqual(there.log, ['update Report'])
		assert.deepEqual(here.log, [])
	})

	it('re-creates what moves to another calendar, keeping its uid and rank, then deletes the original', async () => {
		const here = calendar('here', 'https://dav/here/')
		const there = calendar('there', 'https://other/there/')
		const entry = task(here.calendar)
		const change = entry.edit(patchOf({ sourceId: 'there' }))
		change.edited.source = there.calendar
		assert.equal(change.recreates, true)
		const saved = await change.save(em)
		assert.notEqual(saved.id, 'task')
		assert.equal(saved.uid, 'task-uid')
		assert.equal(saved.sourceId, 'there')
		assert.equal(saved.rank, entry.rank)
		assert.deepEqual(there.log, ['create Report'])
		assert.deepEqual(here.log, ['delete task'])
	})

	it('re-creates a task turned into an event, with a fresh uid where both calendars share a server path and without its rank', async () => {
		const here = calendar('here', 'https://dav/shared/')
		const saved = await task(here.calendar).edit(patchOf({ type: EntryType.Event })).save(em)
		assert.notEqual(saved.uid, 'task-uid')
		assert.equal(saved.rank, undefined)
		assert.deepEqual(here.log, ['create Report', 'delete task'])
	})

	it('takes the copy back when the original cannot be deleted', async () => {
		const here = calendar('here', 'https://dav/here/', { failDelete: true })
		const there = calendar('there', 'https://other/there/')
		const deleted = new Array<string>()
		Object.assign(there.calendar.integration, { deleteEntry: (_em: EntityManager, entry: Entry) => (deleted.push(entry.sourceId), Promise.resolve()) })
		const change = task(here.calendar).edit(patchOf({ sourceId: 'there' }))
		change.edited.source = there.calendar
		await assert.rejects(change.save(em), /Refused/)
		assert.deepEqual(deleted, ['there'])
	})

	it('refuses everything at once: the organizer\'s list changed by someone else, beside what the calendar cannot hold', () => {
		const here = calendar('here', 'https://dav/here/')
		const entry = Object.assign(task(here.calendar), { participants: Participants.normalize([{ email: 'organizer@example.com', organizer: true }, { email: 'me@example.com', self: true }]) })
		const change = entry.edit(patchOf({ participants: null, visibility: Visibility.Private }))
		const refusals = [...change.validate()]
		assert.deepEqual(refusals.map(refusal => refusal.fields), [['participants'], ['visibility']])
		assert.equal((refusals[0]!.constructor as { status?: number }).status, 403)
	})
})
