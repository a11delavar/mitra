import { before, after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, type EntityManager } from '@mikro-orm/sqlite'
import { ormConfig } from '../../infrastructure/database/ormConfig.js'
import { User } from '../../features/identity/User.js'
import { Source } from '../../features/sources/Source.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { Todoist } from './Todoist.js'
import { type TodoistTask } from './TodoistClient.js'

const task = (date: string): TodoistTask => ({
	id: 'task-1', project_id: 'project-1', content: 'Scheduled task',
	due: { date, timezone: 'Europe/Madrid' }, duration: { amount: 30, unit: 'minute' },
})

async function seed(em: EntityManager, tasks: Array<TodoistTask>) {
	const user = new User({ username: `operator-${crypto.randomUUID()}` })
	const integration = new Todoist({ userId: user.id, credentials: { username: '', token: 'test-token' } })
	const source = new Source({ integrationId: integration.id, uri: Todoist.sourceUri('project-1'), entryTypes: [EntryType.Task], name: 'Project', enabled: true })
	em.persist([user, integration, source])
	await em.flush()
	const updates: Array<string> = []
	;(integration as any).client = {
		tasks: () => Promise.resolve(tasks),
		completedTasks: () => Promise.resolve([]),
		updateTask: (id: string) => { updates.push(id); return Promise.resolve(tasks[0]) },
		task: () => Promise.resolve(tasks[0]),
		createTask: () => { throw new Error('An edit must not create a task') },
	}
	return { integration, source, updates }
}

describe('Todoist synchronization', () => {
	let orm: MikroORM
	before(async () => { orm = await MikroORM.init(ormConfig(':memory:')); await orm.schema.update() })
	after(async () => { await orm.close(true) })

	it('imports an API v1 timed task and updates the same row on a later sync', async () => {
		const em = orm.em.fork()
		const tasks = [task('2026-10-13T16:15:00Z')]
		const { integration, source } = await seed(em, tasks)
		await integration.syncSource(em, source)
		await em.flush()
		const entry = await em.findOneOrFail(Entry, { sourceId: source.id })
		const id = entry.id
		assert.equal(entry.type, EntryType.Task)
		assert.equal(entry.start?.toISOString(), '2026-10-13T16:15:00.000Z')
		tasks[0] = task('2026-10-14T08:45:00Z')
		await integration.syncSource(em, source)
		await em.flush()
		assert.equal(await em.count(Entry, { sourceId: source.id }), 1)
		assert.equal(entry.id, id)
		assert.equal(entry.uri, 'task-1')
		assert.equal(entry.start?.toISOString(), '2026-10-14T08:45:00.000Z')
	})

	it('does not leave an incomplete row queued if parsing a remote date fails', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, [task('invalid-date')])
		await assert.rejects(() => integration.syncSource(em, source))
		await em.flush()
		assert.equal(await em.count(Entry, { sourceId: source.id }), 0)
	})

	it('edits a scheduled task using its existing Todoist id', async () => {
		const em = orm.em.fork()
		const tasks = [task('2026-10-13T16:15:00Z')]
		const { integration, source, updates } = await seed(em, tasks)
		await integration.syncSource(em, source)
		await em.flush()
		const entry = await em.findOneOrFail(Entry, { sourceId: source.id })
		const incoming = entry.clone()
		incoming.heading = 'Updated task'
		tasks[0] = { ...tasks[0]!, content: incoming.heading }
		await integration.updateEntry(em, entry, incoming)
		await em.flush()
		assert.deepEqual(updates, ['task-1'])
		assert.equal(entry.heading, incoming.heading)
		assert.equal(await em.count(Entry, { sourceId: source.id }), 1)
	})
})
