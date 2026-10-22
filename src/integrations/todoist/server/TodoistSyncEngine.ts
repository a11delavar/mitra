import { type EntityManager } from '@mikro-orm/sqlite'
import { Source } from '#features/sources'
import { Entry } from '#features/entries'
import { EntryRelations, RelationType } from '#features/relations'
import type { Integration, AccountSyncEngine } from '#integrations'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { Todoist, type TodoistTask, type TodoistWriteContext } from '../Todoist.js'
import { TodoistClient, TodoistRequestError } from './TodoistClient.js'

const logger = createLogger('Todoist')

interface TodoistSyncState {
	/** Todoist's mark of what the account's tasks were last read up to. */
	token?: string
}

/**
 * Todoist tells its changes per account, so one read syncs every enabled project: in full (`*`) while one is being
 * imported, else only what changed since the last read, deletions and completions included. Nothing is ever taken
 * as deleted for missing from a delta.
 */
export class TodoistSyncEngine implements AccountSyncEngine {
	/** How far back a full read reaches for completed tasks: Todoist answers at most three months at once. */
	private static readonly completedWindow = { weeks: 12 }

	private client(integration: Todoist) {
		return integration.client ??= new TodoistClient(integration.credentials.token)
	}

	async fetchSources(integration: Integration) {
		const todoist = integration as Todoist
		const { user, user_plan_limits, projects } = await this.client(todoist).sync({ syncToken: '*', resourceTypes: ['user', 'user_plan_limits', 'projects'] }).catch((error: unknown) => {
			throw error instanceof TodoistRequestError && (error.status === 401 || error.status === 403)
				? new Error('Todoist refused the API token. Copy it again from Settings → Integrations → Developer in Todoist')
				: error
		})
		if (!user) {
			throw new Error('Todoist did not say whose account this is')
		}
		// Every sync discovers first, so a trial begun or ended shows here; what Mitra then holds of each task changed, so it reads them all again.
		const held = todoist.ownership
		todoist.adopt({ user, limits: user_plan_limits?.current })
		if ((['due', 'estimate'] as const).some(field => held.holds(field) !== todoist.ownership.holds(field))) {
			todoist.syncState = { ...todoist.syncState, token: undefined }
		}
		return Todoist.sourcesFrom(projects ?? [])
	}

	async syncAccountEntries(integration: Integration, em: EntityManager, sources: ReadonlyArray<Source>) {
		if (!sources.length) {
			return false
		}
		const todoist = integration as Todoist
		const client = this.client(todoist)
		const state = (todoist.syncState ?? {}) as TodoistSyncState
		const full = !state.token || sources.some(source => !source.importedAt)
		const response = await client.sync({ syncToken: full ? '*' : state.token, resourceTypes: ['items'] })
		// Completed tasks leave the active list, so a full read fetches them apart; later, completions come with the delta.
		const tasks = [...full ? await this.completed(client) : [], ...response.items ?? []]
		const changed = await this.apply(todoist, em, sources, tasks, full)
		todoist.syncState = { ...todoist.syncState, token: response.sync_token ?? state.token }
		logger.debug(`Synced ${todoist.toString()}: ${full ? 'all' : 'changed'} tasks, ${tasks.length} read${changed ? '' : ' (no local changes)'}`)
		// Read again in full though imported: the plan changed what Mitra holds, which open tabs learn with the integration.
		const replanned = !state.token && sources.every(source => source.importedAt)
		return changed || replanned
	}

	private async completed(client: TodoistClient) {
		const until = Temporal.Now.zonedDateTimeISO('UTC')
		const since = until.subtract(TodoistSyncEngine.completedWindow)
		const tasks = await client.completedTasks(new Date(since.epochMilliseconds), new Date(until.epochMilliseconds))
		return tasks.map(task => ({ ...task, checked: true }))
	}

	/**
	 * Applies `tasks` to the calendars of their projects, moving an entry whose task changed project. A full read also
	 * removes the open entries it no longer lists; a done one stays, as Todoist keeps old completions out of reach.
	 */
	private async apply(todoist: Todoist, em: EntityManager, sources: ReadonlyArray<Source>, tasks: ReadonlyArray<TodoistTask>, full: boolean) {
		const sourceOf = new Map(sources.map(source => [Todoist.projectIdOf(source), source]))
		const existing = new Array<Entry>()
		for (const source of sources) {
			existing.push(...await todoist.syncedEntries(em, source))
		}

		const byUri = new Map(existing.flatMap(entry => entry.uri ? [[entry.uri, entry] as const] : []))
		const ids = new Set([...byUri.keys(), ...tasks.map(task => task.id)])
		const isTask = (uid: string) => ids.has(uid)
		const { ownership } = todoist
		const zone = Todoist.zoneOf(todoist)
		let changed = false

		for (const task of tasks) {
			const entry = byUri.get(task.id)
			const source = sourceOf.get(task.project_id)
			if (task.is_deleted || !source) {
				if (entry) {
					em.remove(entry)
					byUri.delete(task.id)
					changed = true
				}
				continue
			}
			const before = entry?.clone()
			const relationsBefore = entry?.relations
			const target = entry ?? new Entry({ id: crypto.randomUUID(), sourceId: source.id })
			if (!entry) {
				em.persist(target)
				byUri.set(task.id, target)
			}
			target.sourceId = source.id
			Todoist.applyTask(target, task, { ownership, zone, relations: Todoist.relationsFrom(task, relationsBefore, isTask) })
			if (!before || !before.equals(target) || (relationsBefore ?? EntryRelations.none).writesDiffer(target.relations!)) {
				changed = true
			}
		}

		if (full) {
			const read = new Set(tasks.map(task => task.id))
			for (const [uri, entry] of byUri) {
				if (!read.has(uri) && !entry.done) {
					em.remove(entry)
					changed = true
				}
			}
		}

		return changed
	}

	// --- Writes -----------------------------------------------------------------------------------

	/** The account as a write reads it: which of the parents the entries name are its tasks, the only ones Todoist holds. */
	private async contextFor(todoist: Todoist, em: EntityManager, ...entries: Array<Entry>): Promise<TodoistWriteContext> {
		const parents = new Set(entries.flatMap(entry => entry.relations?.writes.filter(relation => relation.type === RelationType.Parent).map(relation => relation.targetUid) ?? []))
		const tasks = new Set<string>()
		for (const source of parents.size ? await em.find(Source, { integrationId: todoist.id }) : []) {
			for (const { uri } of await todoist.syncedEntries(em, source)) {
				if (uri && parents.has(uri)) {
					tasks.add(uri)
				}
			}
		}
		return { zone: Todoist.zoneOf(todoist), isTask: uid => tasks.has(uid) }
	}

	/**
	 * Reads the task back, as Todoist settles what it was told: a closed repeating task comes back open at its next date,
	 * and a subtask lands in its parent's project, whose calendar the entry then joins.
	 */
	private async adopt(todoist: Todoist, em: EntityManager, entry: Entry, id: string, relations: Entry['relations'], context: TodoistWriteContext) {
		const task = await this.client(todoist).task(id)
		Todoist.applyTask(entry, task, { ownership: todoist.ownership, zone: context.zone, relations: Todoist.relationsFrom(task, relations, context.isTask) })
		const source = await em.findOne(Source, { integrationId: todoist.id, uri: Todoist.sourceUri(task.project_id) })
		entry.sourceId = source?.id ?? entry.sourceId
	}

	/**
	 * Todoist took the write, so a failed read-back leaves the entry as written for the next sync to settle: failing the
	 * save would have it retried, and a retry creates a second task or completes a repeating one a second time.
	 */
	private async adoptOrKeep(todoist: Todoist, em: EntityManager, entry: Entry, id: string, relations: Entry['relations'], context: TodoistWriteContext) {
		try {
			await this.adopt(todoist, em, entry, id, relations, context)
		} catch (error) {
			logger.warn(`Wrote task ${id} to ${todoist.toString()} but could not read it back; the next sync brings it: ${error instanceof Error ? error.message : String(error)}`)
			entry.relations = relations
		}
	}

	async createEntry(integration: Integration, em: EntityManager, entry: Entry) {
		const todoist = integration as Todoist
		const source = await em.findOneOrFail(Source, { id: entry.sourceId })
		const context = await this.contextFor(todoist, em, entry)
		const tempId = crypto.randomUUID()
		const ids = await this.client(todoist).execute(Todoist.addCommandsFor(entry, { projectId: Todoist.projectIdOf(source), tempId, ownership: todoist.ownership, context }))
		const id = ids[tempId]
		if (!id) {
			throw new Error('Todoist did not say which task it created')
		}
		entry.uri = entry.uid = id
		await this.adoptOrKeep(todoist, em, entry, id, entry.relations, context)
		em.persist(entry)
		return entry
	}

	/** Writes only what changed, moving the task when it changed calendar, so what Mitra does not show stays. */
	async updateEntry(integration: Integration, em: EntityManager, existing: Entry, incoming: Entry) {
		const todoist = integration as Todoist
		const target = await em.findOneOrFail(Source, { id: incoming.sourceId })
		const context = await this.contextFor(todoist, em, existing, incoming)
		const commands = Todoist.commandsFor(existing, incoming, { projectId: Todoist.projectIdOf(target), ownership: todoist.ownership, context })
		const relations = incoming.relations ?? existing.relations
		if (!commands.length) {
			existing.relations = relations
			return
		}
		await this.client(todoist).execute(commands)
		existing.equate(incoming)
		await this.adoptOrKeep(todoist, em, existing, existing.uri!, relations, context)
	}

	async deleteEntry(integration: Integration, em: EntityManager, entry: Entry) {
		if (entry.uri) {
			try {
				await this.client(integration as Todoist).execute([{ type: 'item_delete', args: { id: entry.uri } }])
			} catch (error) {
				if (!(error instanceof TodoistRequestError) || error.status !== 404) {
					throw error
				}
			}
		}
		em.remove(entry)
	}

	excludeOccurrence(): Promise<void> {
		return Promise.reject(new Error('Todoist keeps a repeating task\'s dates itself'))
	}
}
