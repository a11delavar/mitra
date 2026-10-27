import { type EntityManager } from '@mikro-orm/sqlite'
import { Source } from '#features/sources'
import { Entry, TaskStatus } from '#features/entries'
import { EntryRelations, RelationType } from '#features/relations'
import type { Integration, SourceSyncEngine } from '#integrations'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { TickTick, type TickTickTask } from '../TickTick.js'
import { TickTickClient, TickTickRequestError } from './TickTickClient.js'

const logger = createLogger('TickTick')

interface TickTickSyncState {
	/** Until when the list's completions were read. */
	completedThrough?: string
}

interface TickTickWriteContext {
	readonly zone: string
	readonly isTask: (uid: string) => boolean
}

/**
 * TickTick tells no changes, so each sync reads a list whole: its open tasks, those completed since the last read, and
 * those it won't do, which nothing else lists. An open or won't-do entry the read no longer names was deleted or moved;
 * a done one stays, as TickTick keeps old completions out of reach.
 */
export class TickTickSyncEngine implements SourceSyncEngine {
	/** How far back an import reaches for completed tasks. */
	private static readonly completedWindow = { weeks: 12 }
	/** Completions are read again this far back, as one may land just before the clock read it. */
	private static readonly overlap = { minutes: 5 }

	private client(integration: TickTick) {
		return integration.client ??= new TickTickClient(integration.credentials.token)
	}

	async fetchSources(integration: Integration) {
		const ticktick = integration as TickTick
		const client = this.client(ticktick)
		const projects = await client.projects().catch((error: unknown) => {
			throw error instanceof TickTickRequestError && (error.status === 401 || error.status === 403)
				? new Error('TickTick refused the API token. Create one again under Settings → Account → API Keys in TickTick')
				: error
		})
		// The account is named only among a list's members, read once.
		if (!ticktick.uri) {
			const self = projects[0] ? await client.self(projects[0].id) : undefined
			ticktick.adopt({ username: self?.username, timeZone: (await client.preference()).timeZone })
		}
		return TickTick.sourcesFrom(projects, await client.groups())
	}

	async syncSourceEntries(integration: Integration, em: EntityManager, source: Source) {
		const ticktick = integration as TickTick
		const client = this.client(ticktick)
		const projectId = TickTick.projectIdOf(source)
		const state = (source.syncState ?? {}) as TickTickSyncState
		const now = Temporal.Now.instant()
		const since = state.completedThrough && source.importedAt
			? Temporal.Instant.from(state.completedThrough).subtract(TickTickSyncEngine.overlap)
			: now.toZonedDateTimeISO('UTC').subtract(TickTickSyncEngine.completedWindow).toInstant()

		const open = await client.openTasks(projectId)
		const completed = await client.completedTasks(projectId, new Date(since.epochMilliseconds), new Date(now.epochMilliseconds))
		const abandoned = await client.tasksIn(projectId, [-1])
		const tasks = [...new Map([...completed, ...abandoned, ...open].filter(task => task.kind !== 'NOTE').map(task => [task.id, task])).values()]

		const changed = await this.apply(ticktick, em, source, tasks)
		source.syncState = { ...source.syncState, completedThrough: now.toString() }
		logger.debug(`Synced "${source.name}": ${open.length} open, ${completed.length} completed, ${abandoned.length} won't do${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	private async apply(ticktick: TickTick, em: EntityManager, source: Source, tasks: ReadonlyArray<TickTickTask>) {
		const existing = await ticktick.syncedEntries(em, source)
		const byUri = new Map(existing.flatMap(entry => entry.uri ? [[entry.uri, entry] as const] : []))
		const ids = new Set([...byUri.keys(), ...tasks.map(task => task.id)])
		const isTask = (uid: string) => ids.has(uid)
		const zone = TickTick.zoneOf(ticktick)
		let changed = false

		for (const task of tasks) {
			const entry = byUri.get(task.id)
			const before = entry?.clone()
			const relationsBefore = entry?.relations
			const target = entry ?? new Entry({ id: crypto.randomUUID(), sourceId: source.id })
			if (!entry) {
				em.persist(target)
			}
			TickTick.applyTask(target, task, { zone, relations: TickTick.relationsFrom(task, relationsBefore, isTask) })
			if (!before || !before.equals(target) || (relationsBefore ?? EntryRelations.none).writesDiffer(target.relations!)) {
				changed = true
			}
		}

		const read = new Set(tasks.map(task => task.id))
		for (const [uri, entry] of byUri) {
			if (!read.has(uri) && entry.status !== TaskStatus.Done) {
				em.remove(entry)
				changed = true
			}
		}
		return changed
	}

	// --- Writes -----------------------------------------------------------------------------------

	/** The account as a write reads it: which of the parents the entries name are its tasks, the only ones TickTick holds. */
	private async contextFor(ticktick: TickTick, em: EntityManager, ...entries: Array<Entry>): Promise<TickTickWriteContext> {
		const parents = new Set(entries.flatMap(entry => entry.relations?.writes.filter(relation => relation.type === RelationType.Parent).map(relation => relation.targetUid) ?? []))
		const tasks = new Set<string>()
		for (const source of parents.size ? await em.find(Source, { integrationId: ticktick.id }) : []) {
			for (const { uri } of await ticktick.syncedEntries(em, source)) {
				if (uri && parents.has(uri)) {
					tasks.add(uri)
				}
			}
		}
		return { zone: TickTick.zoneOf(ticktick), isTask: uid => tasks.has(uid) }
	}

	/** Reads the task back, as TickTick settles what it was told: a completed repeating task comes back open at its next date. */
	private async adopt(ticktick: TickTick, em: EntityManager, entry: Entry, task: Pick<TickTickTask, 'id' | 'projectId'>, relations: Entry['relations'], context: TickTickWriteContext) {
		const read = await this.client(ticktick).task(task.projectId, task.id)
		TickTick.applyTask(entry, read, { zone: context.zone, relations: TickTick.relationsFrom(read, relations, context.isTask) })
		const source = await em.findOne(Source, { integrationId: ticktick.id, uri: TickTick.sourceUri(read.projectId) })
		entry.sourceId = source?.id ?? entry.sourceId
	}

	/**
	 * TickTick took the write, so a failed read-back leaves the entry as written for the next sync to settle: failing the
	 * save would have it retried, and a retry creates a second task or completes a repeating one a second time.
	 */
	private async adoptOrKeep(ticktick: TickTick, em: EntityManager, entry: Entry, task: Pick<TickTickTask, 'id' | 'projectId'>, relations: Entry['relations'], context: TickTickWriteContext) {
		try {
			await this.adopt(ticktick, em, entry, task, relations, context)
		} catch (error) {
			logger.warn(`Wrote task ${task.id} to ${ticktick.toString()} but could not read it back; the next sync brings it: ${error instanceof Error ? error.message : String(error)}`)
			entry.relations = relations
		}
	}

	/** Completes, reopens or gives up a task: completing goes through TickTick's own, which moves a repeating task on. */
	private async writeStatus(client: TickTickClient, task: Pick<TickTickTask, 'id' | 'projectId'>, status: TaskStatus | undefined) {
		if (status === TaskStatus.Done) {
			await client.completeTask(task.projectId, task.id)
		} else {
			await client.updateTask(task.id, task.projectId, { status: status === TaskStatus.Cancelled ? -1 : 0 })
		}
	}

	async createEntry(integration: Integration, em: EntityManager, entry: Entry) {
		const ticktick = integration as TickTick
		const client = this.client(ticktick)
		const source = await em.findOneOrFail(Source, { id: entry.sourceId })
		const context = await this.contextFor(ticktick, em, entry)
		const task = await client.createTask(TickTick.createdFrom(entry, TickTick.projectIdOf(source), context))
		entry.uri = entry.uid = task.id
		if (entry.closed) {
			await this.writeStatus(client, task, entry.status)
		}
		await this.adoptOrKeep(ticktick, em, entry, task, entry.relations, context)
		em.persist(entry)
		return entry
	}

	/** Writes only what changed, moving the task first when it changed list, so what Mitra does not show stays. */
	async updateEntry(integration: Integration, em: EntityManager, existing: Entry, incoming: Entry) {
		const ticktick = integration as TickTick
		const client = this.client(ticktick)
		const id = existing.uri
		if (!id) {
			throw new Error('This entry has no TickTick task id')
		}
		const origin = await em.findOneOrFail(Source, { id: existing.sourceId })
		const target = await em.findOneOrFail(Source, { id: incoming.sourceId })
		const from = TickTick.storedTaskOf(existing)?.projectId ?? TickTick.projectIdOf(origin)
		const task = { id, projectId: TickTick.sourceUri(from) === target.uri ? from : TickTick.projectIdOf(target) }
		const context = await this.contextFor(ticktick, em, existing, incoming)
		const changes = TickTick.changesFrom(existing, incoming, context)
		const relations = incoming.relations ?? existing.relations

		const moved = task.projectId !== from
		const changed = Object.keys(changes).length > 0
		const status = existing.status !== incoming.status
		if (!moved && !changed && !status) {
			existing.relations = relations
			return
		}
		if (moved) {
			await client.moveTask(id, from, task.projectId)
		}
		if (changed) {
			await client.updateTask(id, task.projectId, changes)
		}
		if (status) {
			await this.writeStatus(client, task, incoming.status)
		}
		existing.equate(incoming)
		await this.adoptOrKeep(ticktick, em, existing, task, relations, context)
	}

	async deleteEntry(integration: Integration, em: EntityManager, entry: Entry) {
		if (entry.uri) {
			const source = await em.findOneOrFail(Source, { id: entry.sourceId })
			const projectId = TickTick.storedTaskOf(entry)?.projectId ?? TickTick.projectIdOf(source)
			try {
				await this.client(integration as TickTick).deleteTask(projectId, entry.uri)
			} catch (error) {
				if (!(error instanceof TickTickRequestError) || error.status !== 404) {
					throw error
				}
			}
		}
		em.remove(entry)
	}

	excludeOccurrence(): Promise<void> {
		return Promise.reject(new Error('TickTick keeps a repeating task\'s dates itself'))
	}
}
