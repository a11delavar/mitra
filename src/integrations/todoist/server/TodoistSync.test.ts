import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { User } from '#features/identity'
import { Entry, TaskStatus, EntryType, EntryPatch } from '#features/entries'
import { EntryRelations, RelationType } from '#features/relations'
import '#integrations/server/registerEngines.js'
import { ormConfig } from '#infrastructure/database/ormConfig.js'
import { migrate } from '#infrastructure/database/migrations/migrate.js'
import { wireOf } from '#infrastructure/model/wire.testing.js'
import { Todoist, type TodoistCommand, type TodoistPlanLimits, type TodoistProject, type TodoistTask, type TodoistUser } from '../Todoist.js'
import { TodoistSyncEngine } from './TodoistSyncEngine.js'
import { TodoistRequestError, type TodoistClient, type TodoistResourceType } from './TodoistClient.js'

/** A Todoist account as its API tells it: everything on a full read, then what changed since the last one. */
class Account {
	readonly reads = new Array<{ syncToken?: string, resourceTypes: ReadonlyArray<TodoistResourceType> }>()
	readonly tasks = new Map<string, TodoistTask>()
	completed = new Array<TodoistTask>()
	user: TodoistUser = { id: 'user-1', email: 'owner@example.com', tz_info: { timezone: 'Europe/Madrid' } }
	limits: TodoistPlanLimits = { deadlines: true, durations: true }
	projects: Array<TodoistProject> = [
		{ id: 'inbox', name: 'Inbox', inbox_project: true },
		{ id: 'work', name: 'Work', child_order: 1 },
		{ id: 'home', name: 'Home', child_order: 2 },
	]
	refusesToken = false
	/** Reading a task back fails, as a request after a write can. */
	failsReadBack = false
	readonly commands = new Array<TodoistCommand>()
	/** Tasks closed from Mitra, which leave the active list but still read by id. */
	private readonly closed = new Map<string, TodoistTask>()
	private changes = new Array<TodoistTask>()
	private version = 0
	private minted = 0

	add(...tasks: Array<TodoistTask>) {
		for (const task of tasks) {
			this.tasks.set(task.id, task)
		}
	}

	/** A change made in Todoist: a deleted or completed task leaves the active list, and the next delta tells it. */
	change(task: TodoistTask) {
		if (task.is_deleted || task.checked) {
			this.tasks.delete(task.id)
		} else {
			this.tasks.set(task.id, task)
		}
		this.changes.push(task)
	}

	readonly client = {
		sync: ({ syncToken, resourceTypes = [] }: { syncToken?: string, resourceTypes?: ReadonlyArray<TodoistResourceType> }) => {
			if (this.refusesToken) {
				return Promise.reject(new TodoistRequestError(401, 'Todoist request failed (401): Invalid token'))
			}
			this.reads.push({ syncToken, resourceTypes })
			if (resourceTypes.includes('projects')) {
				return Promise.resolve({ sync_token: 'discovery', user: this.user, user_plan_limits: { current: this.limits }, projects: this.projects })
			}
			const items = syncToken === '*' ? [...this.tasks.values()] : this.changes
			this.changes = []
			return Promise.resolve({ sync_token: `token-${++this.version}`, full_sync: syncToken === '*', items })
		},
		completedTasks: () => Promise.resolve(this.completed),
		task: (id: string) => {
			if (this.failsReadBack) {
				return Promise.reject(new TodoistRequestError(503, 'Todoist request failed (503): Service Unavailable'))
			}
			const found = this.tasks.get(id) ?? this.closed.get(id)
			return found ? Promise.resolve(found) : Promise.reject(new TodoistRequestError(404, 'Todoist request failed (404): Task not found'))
		},
		execute: (commands: ReadonlyArray<TodoistCommand>) => {
			const ids: Record<string, string> = {}
			for (const command of commands) {
				this.commands.push(command)
				if (command.type === 'item_add') {
					const { project_id, parent_id, ...fields } = command.args
					const added = task(ids[command.temp_id] = `new-${++this.minted}`, project_id, { ...fields, parent_id: parent_id ?? null, priority: 1, labels: [] })
					this.tasks.set(added.id, added)
					continue
				}
				const id = ids[command.args.id] ?? command.args.id
				const current = this.tasks.get(id) ?? this.closed.get(id)
				if (!current) {
					return Promise.reject(new TodoistRequestError(404, `Todoist refused ${command.type}: Task not found`))
				}
				switch (command.type) {
					case 'item_update': {
						const { id: _, ...fields } = command.args
						this.tasks.set(id, { ...current, ...fields })
						break
					}
					case 'item_move': {
						const { args } = command
						this.tasks.set(id, 'parent_id' in args
							? { ...current, parent_id: args.parent_id, project_id: this.tasks.get(args.parent_id)!.project_id }
							: { ...current, parent_id: null, project_id: args.project_id })
						break
					}
					case 'item_close':
						if (current.due?.is_recurring) {
							this.tasks.set(id, { ...current, due: { ...current.due, date: Temporal.PlainDate.from(current.due.date).add({ weeks: 1 }).toString() } })
						} else {
							this.tasks.delete(id)
							this.closed.set(id, { ...current, checked: true })
						}
						break
					case 'item_uncomplete':
						this.closed.delete(id)
						this.tasks.set(id, { ...current, checked: false })
						break
					case 'item_delete':
						this.tasks.delete(id)
						this.closed.delete(id)
				}
			}
			return Promise.resolve(ids)
		},
	}

	/** The task reads, leaving out discovery's. */
	get taskReads() {
		return this.reads.filter(read => read.resourceTypes.includes('items')).map(read => read.syncToken)
	}
}

const task = (id: string, project_id: string, init?: Partial<TodoistTask>): TodoistTask => ({
	id, project_id, content: `Task ${id}`, description: '', checked: false, due: null, deadline: null, duration: null, ...init,
})

describe('Todoist sync', () => {
	let orm: MikroORM
	before(async () => {
		orm = await MikroORM.init({ ...ormConfig(':memory:'), allowGlobalContext: true })
		await migrate(orm)
	})
	after(() => orm.close(true))

	/** A connected account with Inbox and Work turned on, Home off. */
	async function connect(account = new Account()) {
		const em = orm.em.fork()
		const user = new User({ username: `owner-${crypto.randomUUID()}` })
		const integration = new Todoist({ userId: user.id, credentials: { username: '', token: 'todoist-secret', timeZone: '', deadlines: false, durations: false } })
		integration.client = account.client as unknown as TodoistClient
		em.persist([user, integration])
		const sources = await integration.getSources(em)
		for (const source of sources) {
			source.enabled = source.name !== 'Home'
		}
		await em.flush()
		const sourceOf = (name: string) => sources.find(source => source.name === name)!
		const entries = () => em.find(Entry, { sourceId: { $in: sources.map(source => source.id) } }, { orderBy: { uri: 'asc' } })
		const entryOf = async (uri: string) => (await entries()).find(entry => entry.uri === uri)
		const sync = async () => {
			const changed = await integration.sync(em)
			await em.flush()
			return changed
		}
		return { em, account, integration, sources, sourceOf, entries, entryOf, sync }
	}

	describe('discovery', () => {
		it('learns the account and lists its projects, all turned off', async () => {
			const account = new Account()
			const integration = new Todoist({ credentials: { username: '', token: 'todoist-secret', timeZone: '', deadlines: false, durations: false } })
			integration.client = account.client as unknown as TodoistClient
			const sources = await new TodoistSyncEngine().fetchSources(integration)
			assert.equal(integration.uri, 'todoist://account/user-1')
			assert.deepEqual(integration.credentials, { username: 'owner@example.com', token: 'todoist-secret', timeZone: 'Europe/Madrid', deadlines: true, durations: true })
			assert.deepEqual(sources.map(source => [source.name, source.enabled]), [['Inbox', false], ['Work', false], ['Home', false]])
			assert.deepEqual(account.reads, [{ syncToken: '*', resourceTypes: ['user', 'user_plan_limits', 'projects'] }])
		})

		it('says what to do about a token Todoist refuses', async () => {
			const account = new Account()
			account.refusesToken = true
			const integration = new Todoist({ credentials: { username: '', token: 'stale', timeZone: '', deadlines: false, durations: false } })
			integration.client = account.client as unknown as TodoistClient
			await assert.rejects(new TodoistSyncEngine().fetchSources(integration), /Todoist refused the API token/)
		})
	})

	describe('the first read', () => {
		it('imports every turned-on project in one read, done tasks of the last weeks included', async () => {
			const account = new Account()
			account.add(task('t1', 'inbox'), task('t2', 'work'), task('t3', 'home'))
			account.completed = [task('t4', 'work', { completed_at: '2026-10-10T09:00:00Z' })]
			const { entries, sourceOf, sources, sync, integration } = await connect(account)

			assert.equal(await sync(), true)
			assert.deepEqual((await entries()).map(entry => [entry.uri, entry.sourceId, entry.status]), [
				['t1', sourceOf('Inbox').id, TaskStatus.ToDo],
				['t2', sourceOf('Work').id, TaskStatus.ToDo],
				['t4', sourceOf('Work').id, TaskStatus.Done],
			])
			assert.deepEqual(account.taskReads, ['*'], 'two calendars, one read')
			assert.ok(sources.filter(source => source.enabled).every(source => source.importedAt))
			assert.equal(integration.syncState?.token, 'token-1')
		})

		it('imports every calendar when the importer asks for one', async () => {
			const account = new Account()
			account.add(task('t1', 'inbox'), task('t2', 'work'))
			const { em, integration, sourceOf, entries } = await connect(account)
			await integration.syncSource(em, sourceOf('Inbox'))
			await em.flush()
			assert.ok(sourceOf('Work').importedAt)
			assert.equal((await entries()).length, 2)
		})

		it('keeps the token off the wire', async () => {
			const { integration, sync } = await connect()
			await sync()
			assert.equal('syncState' in wireOf(integration), false)
		})
	})

	describe('later reads', () => {
		it('read only what changed since the last one', async () => {
			const account = new Account()
			account.add(task('t1', 'inbox'), task('t2', 'work'))
			const { entries, entryOf, sync } = await connect(account)
			await sync()
			const id = (await entryOf('t1'))!.id

			account.change(task('t1', 'inbox', { content: 'Renamed' }))
			account.change(task('t5', 'work'))
			assert.equal(await sync(), true)

			assert.deepEqual(account.taskReads, ['*', 'token-1'])
			const renamed = (await entryOf('t1'))!
			assert.equal(renamed.id, id, 'the same entry, changed in place')
			assert.equal(renamed.heading, 'Renamed')
			assert.deepEqual((await entries()).map(entry => entry.uri), ['t1', 't2', 't5'])
		})

		it('follows the plan as a trial begins, reading every task again for what it now holds', async () => {
			const account = new Account()
			account.limits = { deadlines: false, durations: false }
			account.add(task('t1', 'work', { deadline: { date: '2026-10-30' } }))
			const { integration, entryOf, sync } = await connect(account)
			await sync()
			assert.equal((await entryOf('t1'))!.due, undefined)

			account.limits = { deadlines: true, durations: true }
			await sync()
			assert.equal(integration.ownership.ownerOf('due'), 'upstream')
			assert.deepEqual(account.taskReads, ['*', '*'])
			assert.equal((await entryOf('t1'))!.due?.toISOString(), '2026-10-30T00:00:00.000Z')
		})

		it('tells open tabs the plan changed, though no task did', async () => {
			const account = new Account()
			account.limits = { deadlines: false, durations: false }
			account.add(task('t1', 'work'))
			const { sync } = await connect(account)
			await sync()
			assert.equal(await sync(), false)
			account.limits = { deadlines: true, durations: true }
			assert.equal(await sync(), true)
			assert.equal(await sync(), false)
		})

		it('never takes a task for deleted because a delta leaves it out', async () => {
			const account = new Account()
			account.add(task('t1', 'inbox'), task('t2', 'work'))
			const { entries, sync } = await connect(account)
			await sync()
			assert.equal(await sync(), false)
			assert.equal((await entries()).length, 2)
		})

		it('marks a completed task done and removes a deleted one', async () => {
			const account = new Account()
			account.add(task('t1', 'inbox'), task('t2', 'work'))
			const { entries, entryOf, sync } = await connect(account)
			await sync()

			account.change(task('t1', 'inbox', { checked: true }))
			account.change(task('t2', 'work', { is_deleted: true }))
			await sync()
			assert.equal((await entryOf('t1'))?.status, TaskStatus.Done)
			assert.deepEqual((await entries()).map(entry => entry.uri), ['t1'])
		})

		it('moves an entry with its task, and lets it go to a project that is turned off', async () => {
			const account = new Account()
			account.add(task('t1', 'inbox'), task('t2', 'inbox'))
			const { entryOf, sourceOf, sync } = await connect(account)
			await sync()
			const id = (await entryOf('t1'))!.id

			account.change(task('t1', 'work'))
			account.change(task('t2', 'home'))
			await sync()
			const moved = (await entryOf('t1'))!
			assert.equal(moved.id, id)
			assert.equal(moved.sourceId, sourceOf('Work').id)
			assert.equal(await entryOf('t2'), undefined)
		})
	})

	describe('re-import', () => {
		it('reads everything again, and lets go of open tasks the account no longer has', async () => {
			const account = new Account()
			account.add(task('t1', 'inbox'), task('t2', 'work'))
			account.completed = [task('t3', 'work')]
			const { em, integration, entries, sourceOf, sync } = await connect(account)
			await sync()

			// A change that never reached Mitra, then a re-import of Inbox.
			account.tasks.delete('t2')
			account.completed = []
			await integration.reimportSource(em, sourceOf('Inbox'))
			await sync()

			assert.deepEqual(account.taskReads, ['*', '*'])
			assert.deepEqual((await entries()).map(entry => [entry.uri, entry.status]), [['t1', TaskStatus.ToDo], ['t3', TaskStatus.Done]])
			assert.ok(sourceOf('Inbox').importedAt)
		})
	})

	describe('subtasks', () => {
		it('links a subtask to its parent, and keeps a dependency Mitra holds of its own', async () => {
			const account = new Account()
			account.add(task('t1', 'work'), task('t2', 'work', { parent_id: 't1' }))
			const { em, entryOf, sync } = await connect(account)
			await sync()
			const subtask = (await entryOf('t2'))!
			assert.deepEqual(subtask.relations?.writes.map(relation => [relation.type, relation.targetUid]), [[RelationType.Parent, 't1']])

			subtask.relations = EntryRelations.of([...subtask.relations!.writes, { type: RelationType.FinishToStart, targetUid: 'elsewhere' }])
			await em.flush()
			account.change(task('t2', 'work', { parent_id: null, content: 'On its own' }))
			await sync()

			const after = (await entryOf('t2'))!
			assert.equal(after.heading, 'On its own')
			assert.deepEqual(after.relations?.writes.map(relation => [relation.type, relation.targetUid]), [[RelationType.FinishToStart, 'elsewhere']])
		})
	})

	describe('writes', () => {
		/** A synced account, its entries edited as `EntryChange` hands them over: the row, and a copy carrying the edit. */
		async function synced(...tasks: Array<TodoistTask>) {
			const account = new Account()
			account.add(...tasks)
			const connected = await connect(account)
			await connected.sync()
			const { em, integration } = connected
			const edit = async (uri: string, change: (incoming: Entry) => void) => {
				const existing = (await connected.entryOf(uri))!
				const incoming = existing.clone()
				incoming.relations = existing.relations
				change(incoming)
				await integration.updateEntry(em, existing, incoming)
				await em.flush()
				return existing
			}
			return { ...connected, edit }
		}

		it('creates a task in its calendar\'s project and takes what Todoist made of it', async () => {
			const { em, account, integration, sourceOf } = await synced()
			const entry = new Entry({ id: 'draft', sourceId: sourceOf('Work').id, type: EntryType.Task, heading: 'Book travel', description: '', status: TaskStatus.Done })
			const created = await integration.createEntry(em, entry)
			assert.equal(created.uri, 'new-1')
			assert.equal(created.status, TaskStatus.Done)
			assert.deepEqual(account.commands.map(command => command.type), ['item_add', 'item_close'])
			assert.equal((account.commands[0]!.args as { project_id: string }).project_id, 'work')
		})

		it('keeps a task Todoist made though reading it back fails, so saving again makes no second one', async () => {
			const { em, account, integration, sourceOf, entryOf } = await synced()
			account.failsReadBack = true
			const entry = new Entry({ id: 'draft', sourceId: sourceOf('Work').id, type: EntryType.Task, heading: 'Book travel', description: '' })
			const created = await integration.createEntry(em, entry)
			await em.flush()
			assert.deepEqual([created.uri, created.uid, created.heading], ['new-1', 'new-1', 'Book travel'])
			assert.equal((await entryOf('new-1'))?.id, 'draft')
			assert.deepEqual(account.commands.map(command => command.type), ['item_add'])
		})

		it('keeps an edit Todoist took though reading it back fails, so a repeating task is completed once', async () => {
			const { account, edit } = await synced(task('t1', 'work', { due: { date: '2026-10-19', timezone: null, string: 'every monday', lang: 'en', is_recurring: true } }))
			account.failsReadBack = true
			const entry = await edit('t1', incoming => incoming.status = TaskStatus.Done)
			assert.equal(entry.status, TaskStatus.Done)
			assert.deepEqual(account.commands.map(command => command.type), ['item_close'])
			assert.equal(account.tasks.get('t1')!.due!.date, '2026-10-26')
		})

		it('sends only what changed, so priority and labels stay as Todoist has them', async () => {
			const { account, edit } = await synced(task('t1', 'work', { priority: 4, labels: ['errand'] }))
			const entry = await edit('t1', incoming => incoming.heading = 'Renamed')
			assert.deepEqual(account.commands, [{ type: 'item_update', args: { id: 't1', content: 'Renamed' } }])
			assert.equal(entry.heading, 'Renamed')
			assert.deepEqual([account.tasks.get('t1')!.priority, account.tasks.get('t1')!.labels], [4, ['errand']])
		})

		it('completes a repeating task as Todoist does: it comes back open at its next date', async () => {
			const { edit } = await synced(task('t1', 'work', { due: { date: '2026-10-19', timezone: null, string: 'every monday', lang: 'en', is_recurring: true } }))
			const entry = await edit('t1', incoming => incoming.status = TaskStatus.Done)
			assert.equal(entry.status, TaskStatus.ToDo)
			assert.equal((entry.start as Date | undefined)?.toISOString(), '2026-10-26T00:00:00.000Z')
		})

		it('completes and reopens a one-off task', async () => {
			const { account, edit } = await synced(task('t1', 'work'))
			assert.equal((await edit('t1', incoming => incoming.status = TaskStatus.Done)).status, TaskStatus.Done)
			assert.equal((await edit('t1', incoming => incoming.status = TaskStatus.ToDo)).status, TaskStatus.ToDo)
			assert.deepEqual(account.commands.map(command => command.type), ['item_close', 'item_uncomplete'])
		})

		it('moves a task to another project in place, keeping its entry and what Mitra does not show', async () => {
			const { em, account, entryOf, sourceOf } = await synced(task('t1', 'inbox', { priority: 4 }))
			const existing = (await entryOf('t1'))!
			const change = existing.edit(Object.assign(new EntryPatch(), { sourceId: sourceOf('Work').id }))
			change.edited.source = sourceOf('Work')
			const saved = await change.save(em)
			await em.flush()
			assert.equal(saved, existing)
			assert.equal(saved.sourceId, sourceOf('Work').id)
			assert.deepEqual(account.commands, [{ type: 'item_move', args: { id: 't1', project_id: 'work' } }])
			assert.equal(account.tasks.get('t1')!.priority, 4)
		})

		it('puts a task under its parent, and keeps a dependency of its own', async () => {
			const { account, edit } = await synced(task('t1', 'work'), task('t2', 'work'))
			const entry = await edit('t2', incoming => {
				incoming.relateTo(RelationType.Parent, 't1')
				incoming.relateTo(RelationType.FinishToStart, 'elsewhere')
			})
			assert.deepEqual(account.commands, [{ type: 'item_move', args: { id: 't2', parent_id: 't1' } }])
			assert.deepEqual(entry.relations?.writes.map(relation => `${relation.type.value} ${relation.targetUid}`).sort(), ['FINISHTOSTART elsewhere', 'PARENT t1'])
		})

		it('takes no availability window for a parent, as only the account\'s tasks can be one', async () => {
			const { em, account, integration, sourceOf } = await synced()
			em.persist(new Entry({ id: 'window', sourceId: sourceOf('Work').id, type: EntryType.Availability, uri: 'window-1', heading: 'Office hours' }))
			await em.flush()
			const entry = new Entry({ id: 'draft', sourceId: sourceOf('Work').id, type: EntryType.Task, heading: 'Book travel', description: '' })
			entry.relateTo(RelationType.Parent, 'window-1')
			await integration.createEntry(em, entry)
			assert.equal((account.commands[0]!.args as { parent_id?: string }).parent_id, undefined)
		})

		it('follows a subtask into its parent\'s project, as Todoist moves it there', async () => {
			const { edit, sourceOf } = await synced(task('t1', 'work'), task('t2', 'inbox'))
			const entry = await edit('t2', incoming => incoming.relateTo(RelationType.Parent, 't1'))
			assert.equal(entry.sourceId, sourceOf('Work').id)
		})

		it('deletes a task, and takes one already gone as deleted', async () => {
			const { em, account, integration, entryOf, entries } = await synced(task('t1', 'work'), task('t2', 'work'))
			await integration.deleteEntry(em, (await entryOf('t1'))!)
			account.tasks.delete('t2')
			await integration.deleteEntry(em, (await entryOf('t2'))!)
			await em.flush()
			assert.deepEqual(await entries(), [])
		})
	})
})
