import { entity, primaryKey, property, manyToOne, oneToMany, unique, Collection } from '../infrastructure/model/orm.js'
import { User } from '../features/identity/User.js'
import { Source } from '../features/sources/Source.js'
import { Entry } from '../features/entries/Entry.js'
import { EntryType } from '../features/entries/EntryType.js'
import { EntryRelation } from '../features/relations/EntryRelation.js'
import type { Relation } from '../features/relations/Relation.js'
import { FlushMode, type EntityManager } from '@mikro-orm/core'

/**
 * Protocol sync and CRUD operations registered per integration type.
 */
export interface SyncEngine {
	/** Fetches remote sources, optionally passing existing persisted sources for conditional requests. */
	fetchSources(integration: Integration, existing?: ReadonlyArray<Source>): Promise<Array<Source>>
	syncSourceEntries(integration: Integration, em: EntityManager, source: Source): Promise<boolean>
	createEntry(integration: Integration, em: EntityManager, entry: Entry): Promise<Entry>
	updateEntry(integration: Integration, em: EntityManager, existing: Entry, incoming: Entry): Promise<void>
	deleteEntry(integration: Integration, em: EntityManager, entry: Entry): Promise<void>
	excludeOccurrence(integration: Integration, em: EntityManager, master: Entry, recurrenceId: Date): Promise<void>
	createSource?(integration: Integration, em: EntityManager, source: Source): Promise<Source>
	deleteSource?(integration: Integration, em: EntityManager, source: Source): Promise<void>
	/** Brings what the provider holds for availability in line with `entries`: all of it, or only what stands for the entries in `of`. */
	publishAvailability?(integration: Integration, em: EntityManager, entries: ReadonlyArray<Entry>, of?: ReadonlyArray<Entry>): Promise<boolean>
}

const engines = new Map<string, SyncEngine>()

export function registerEngine(type: string, engine: SyncEngine) {
	engines.set(type, engine)
}

function engineFor(integration: Integration): SyncEngine {
	const engine = engines.get(integration.type)
	if (!engine) {
		throw new Error(`No sync engine registered for integration type '${integration.type}'. See integrations/server/registerEngines.ts. This only ever runs server-side, after that file's import.`)
	}
	return engine
}

/** In-flight sync chains serialized per integration id to prevent concurrent duplicate imports. */
const syncChains = new Map<string, Promise<unknown>>()

@entity({ abstract: true, discriminatorColumn: 'type' })
@unique({ properties: ['userId', 'uri'] })
export abstract class Integration<TCredentials extends Record<string, any> = any> {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => User, { mapToPk: true }) userId!: string

	@property({ type: 'string', nullable: true }) uri?: string

	@property({ type: 'string' }) type!: string

	@property({ type: 'json' }) credentials: TCredentials = {} as TCredentials

	/** Manual sidebar display order among user's integrations (sorted asc nulls last). */
	@property({ type: 'number', nullable: true }) order?: number | null

	/** Lowercase email addresses representing the user in participant lists (RFC 6638). */
	@property({ type: 'json', nullable: true }) addresses?: Array<string>

	@oneToMany(() => Source, source => source.integrationId) sources = new Collection<Source>(this)

	constructor() {
		const type = (new.target as { type?: string }).type
		if (type) {
			this.type = type
		}
	}

	/** Minimum time between background sync polls in ms (0 = every cycle, Infinity = local only). */
	get syncInterval() { return 0 }

	/** Supported data model capabilities (recurrence, reminders, timeZone, etc.). */
	get capabilities() {
		return Integration.defaultCapabilities
	}

	/** Optional icon override for this integration's sources (e.g. 'rss' for subscriptions). */
	get sourceIcon(): string | undefined { return undefined }

	/** Whether re-import can rebuild the entries from somewhere. */
	get reimportable() { return true }

	/** Whether a user can connect this integration only once. */
	static readonly onePerUser: boolean = false

	/** Offered only on a development system (`MITRA_DEV`). */
	static readonly developmentOnly: boolean = false

	/** False when connecting finds nothing, so the first source is created instead. */
	static readonly discoversSources: boolean = true

	/** Returns effective capabilities for a specific source, masking write capabilities if read-only. */
	capabilitiesFor(source: Pick<Source, 'readOnly'> | undefined) {
		return Integration.capabilitiesIn(this.capabilities, source)
	}

	/** Masks write operations in a capability set when the source is read-only. */
	static capabilitiesIn(capabilities: Integration['capabilities'], source: Pick<Source, 'readOnly'> | undefined) {
		return !source?.readOnly ? capabilities : {
			...capabilities,
			createEntries: false, editEntries: false, deleteEntries: false, renameEntries: false, deleteSources: false,
		}
	}

	/** `availability`: whether the provider's calendars take part in availability, which Mitra stores either way. `due` and `estimate`: a task's deadline, and its length while unscheduled. */
	static get defaultCapabilities() {
		return { availability: true, recurrence: true, reminders: true, location: true, description: true, cancelledStatus: true, percentComplete: true, due: true, estimate: true, timeZone: true, participants: true, transparency: true, visibility: true, relations: true, allDay: true, createEntries: true, editEntries: true, deleteEntries: true, renameEntries: true, createSources: false, deleteSources: false }
	}

	/** External link to view the entry at the upstream provider. */
	externalLink(entry: Entry): { url: string, label: string } | undefined {
		const url = Integration.externalUrlOf(entry)
		return !url ? undefined : { url, label: (this.constructor as IntegrationClass).label }
	}

	static externalUrlOf(entry: Entry): string | undefined {
		try {
			return new URL(entry.data?.url ?? '').protocol === 'https:' ? entry.data!.url : undefined
		} catch {
			return undefined
		}
	}

	/** Whether entries of `type` can live in `source`, which for availability also takes the provider's say. */
	canHold(source: Source, type: EntryType): boolean {
		return source.supportsEntryType(type) && (!type.isAvailability || this.capabilitiesFor(source).availability)
	}

	/** Whether `entry` lives only in Mitra's database. Availability always does, since no provider stores it. */
	storesLocally(entry: Pick<Entry, 'type'>): boolean {
		return entry.type.isAvailability
	}

	/** The source's entries its provider holds. Syncs read only these, so they never delete what exists only in Mitra. */
	syncedEntries(em: EntityManager, source: Pick<Source, 'id'>): Promise<Array<Entry>> {
		return em.find(Entry, { sourceId: source.id, type: { $ne: EntryType.Availability } })
	}

	/** Whether the integration wrote this entry to stand in for availability elsewhere, so Mitra shows the availability instead. */
	writtenForAvailability(_entry: Entry): boolean {
		return false
	}

	/** Whether entered credentials satisfy minimum requirements to attempt discovery. */
	get canConnect(): boolean {
		return !!this.uri && !!this.credentials.username
	}

	/**
	 * Fetches the account's remote sources (e.g. calendars, task lists) as transient
	 * (unpersisted) entities. Internal: callers use {@link getSources}, which reconciles
	 * these against the database. Delegates to the registered {@link SyncEngine}. A subclass with no
	 * engine (Notion, Mitra) overrides this directly instead.
	 */
	protected fetchSources(existing?: ReadonlyArray<Source>): Promise<Array<Source>> {
		return engineFor(this).fetchSources(this, existing)
	}

	/** Fetches and stores the entries of a single source. @returns whether any entry changed. Delegates
	 * to the registered {@link SyncEngine}. A subclass with no engine (Notion, Mitra) overrides this directly. */
	protected syncSourceEntries(em: EntityManager, source: Source): Promise<boolean> {
		return engineFor(this).syncSourceEntries(this, em, source)
	}

	/**
	 * Merges the client-supplied `incoming` representation into this integration. Each
	 * provider decides which fields to overwrite and which to preserve. For example,
	 * CalDAV keeps the stored password when `incoming` carries a blank one.
	 */
	abstract merge(incoming: this): void

	editableCopy(): this {
		const constructor = this.constructor as new (init?: Partial<Integration>) => this
		return new constructor({
			id: this.id,
			uri: this.uri,
			credentials: { ...this.credentials },
			// The icon reads color and import state too; without importedAt every enabled row showed a spinner.
			sources: [...this.sources].map(source => new Source({ uri: source.uri, entryTypes: source.entryTypes, name: source.name, enabled: source.enabled, color: source.color, importedAt: source.importedAt })) as any,
		})
	}

	/**
	 * Reconciles persisted sources with remote provider, adding new ones (disabled) and removing obsolete ones.
	 */
	async getSources(em: EntityManager, options?: { checkDuplicate?: boolean }): Promise<Array<Source>> {
		const existing = await em.find(Source, { integrationId: this.id })
		const remote = await this.fetchSources(existing)

		if (options?.checkDuplicate && this.uri) {
			const duplicate = await em.findOne(Integration, { userId: this.userId, uri: this.uri, id: { $ne: this.id } }, { flushMode: FlushMode.COMMIT })
			if (duplicate) {
				throw new Error('This account is already connected. Edit the existing integration instead of adding it again')
			}
		}

		const existingByKey = new Map(existing.map(source => [source.uri, source]))
		const remoteKeys = new Set(remote.map(source => source.uri))

		for (const source of existing) {
			if (!remoteKeys.has(source.uri)) {
				em.remove(source)
			}
		}

		return remote.map(source => {
			const match = existingByKey.get(source.uri)
			if (!match) {
				source.integrationId = this.id
				source.remoteName = source.name
				em.persist(source)
				return source
			}
			if (source.entryTypes.length) {
				match.entryTypes = source.entryTypes
			}
			match.readOnly = source.readOnly
			if (match.remoteName === null || match.remoteName === undefined) {
				match.remoteName = source.name
			} else if (source.name !== match.remoteName) {
				match.name = source.name
				match.remoteName = source.name
			}
			return match
		})
	}

	/**
	 * Mirrors native-parsed relationships into the {@link EntryRelation} store.
	 */
	async reconcileRelations(em: EntityManager, entries: Iterable<Entry>): Promise<void> {
		const byEntryId = new Map<string, Array<Relation> | null>()
		for (const entry of entries) {
			if (entry.id && entry.relations !== undefined) {
				byEntryId.set(entry.id, entry.relations)
			}
		}
		await EntryRelation.reconcileAll(em, byEntryId)
	}

	/**
	 * Syncs a single source, marking it imported once a pass completes without truncation.
	 * @returns whether any entries changed or import completed.
	 */
	async syncSource(em: EntityManager, source: Source): Promise<boolean> {
		const changed = await this.syncSourceEntries(em, source)
		const imported = !source.syncState?.incomplete && source.markImported()
		return changed || imported
	}

	/**
	 * Syncs entries for every currently enabled source.
	 * @returns whether anything worth republishing happened.
	 */
	async syncEntries(em: EntityManager): Promise<boolean> {
		let changed = false
		for (const source of await em.find(Source, { integrationId: this.id, enabled: true })) {
			if (await this.syncSource(em, source)) {
				changed = true
			}
		}
		return changed
	}

	/**
	 * Full synchronization: reconcile sources, then sync entries for enabled sources.
	 */
	sync(em: EntityManager): Promise<boolean> {
		return Integration.exclusively(this.id, async () => {
			await this.getSources(em)
			const changed = await this.syncEntries(em)
			await em.flush()
			return changed
		})
	}

	/** Runs `work` alone among this integration's sync paths. */
	static exclusively<T>(id: string, work: () => Promise<T>): Promise<T> {
		const run = (syncChains.get(id) ?? Promise.resolve()).then(work, work)
		const settled = run.catch(() => undefined)
		syncChains.set(id, settled)
		void settled.then(() => {
			if (syncChains.get(id) === settled) {
				syncChains.delete(id)
			}
		})
		return run
	}

	/**
	 * Runs `work` holding exclusive locks across multiple integration IDs (sorted to prevent deadlocks).
	 */
	static exclusivelyAcross<T>(ids: ReadonlyArray<string>, work: () => Promise<T>): Promise<T> {
		return [...new Set(ids)].sort().reduceRight<() => Promise<T>>((inner, id) => () => Integration.exclusively(id, inner), work)()
	}

	/** Discards cached entries for a source and resets it for full background re-import. */
	async reimportSource(em: EntityManager, source: Source): Promise<void> {
		await Integration.exclusively(this.id, async () => {
			const entries = await this.syncedEntries(em, source)
			entries.forEach(entry => em.remove(entry))
			source.awaitImport()
			await em.flush()
		})
	}

	/**
	 * Applies updated credentials and active source selection from incoming DTO without blocking on entry import.
	 */
	apply(em: EntityManager, incoming: this): Promise<void> {
		return Integration.exclusively(this.id, () => this.applyExclusively(em, incoming))
	}

	private async applyExclusively(em: EntityManager, incoming: this): Promise<void> {
		this.merge(incoming)
		const sources = await this.getSources(em, { checkDuplicate: true })

		const enabledKeys = new Set([...(incoming.sources ?? [])].filter(source => source.enabled).map(source => source.uri))
		for (const source of sources) {
			source.enabled = enabledKeys.has(source.uri)
		}
		await em.flush()
	}

	async createEntry(em: EntityManager, entry: Entry): Promise<Entry> {
		if (!this.storesLocally(entry)) {
			return engineFor(this).createEntry(this, em, entry)
		}
		em.persist(entry)
		await this.stored(em, entry)
		return entry
	}

	async updateEntry(em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		if (!this.storesLocally(existing)) {
			return engineFor(this).updateEntry(this, em, existing, incoming)
		}
		existing.adopt(incoming)
		await this.stored(em, existing)
	}

	async deleteEntry(em: EntityManager, entry: Entry): Promise<void> {
		if (!this.storesLocally(entry)) {
			return engineFor(this).deleteEntry(this, em, entry)
		}
		em.remove(entry)
		await this.stored(em, entry, { removed: true })
	}

	/**
	 * Excludes a single occurrence of a recurring master (RFC 5545 EXDATE).
	 */
	async excludeOccurrence(em: EntityManager, master: Entry, recurrenceId: Date): Promise<void> {
		if (!this.storesLocally(master)) {
			return engineFor(this).excludeOccurrence(this, em, master, recurrenceId)
		}
		master.exclude(recurrenceId)
		await this.stored(em, master)
	}

	/**
	 * Hands the engine a change to an entry Mitra stores, as it hands it every other write: availability may stand for
	 * something at the provider (CalDAV's busy copy), which the engine then brings in line. Without the lock, as any entry write.
	 */
	private async stored(em: EntityManager, entry: Entry, { removed = false } = {}) {
		const engine = engines.get(this.type)
		if (entry.type.isAvailability && engine?.publishAvailability) {
			await engine.publishAvailability(this, em, removed ? [] : [entry], [entry])
		}
	}

	/** Routes check `capabilities.createSources` first; the throw is only a safety net. */
	createSource(em: EntityManager, source: Source): Promise<Source> {
		const engine = engineFor(this)
		if (!engine.createSource) {
			throw new Error(`Integration type '${this.type}' declares createSources but its sync engine implements no createSource`)
		}
		return engine.createSource(this, em, source)
	}

	/** Deletes the source and its entries. Routes check `capabilities.deleteSources` first. */
	deleteSource(em: EntityManager, source: Source): Promise<void> {
		const engine = engineFor(this)
		if (!engine.deleteSource) {
			throw new Error(`Integration type '${this.type}' declares deleteSources but its sync engine implements no deleteSource`)
		}
		return engine.deleteSource(this, em, source)
	}

	/** The availability in `sources`, by default every enabled calendar: masters and single windows, since a rule covers its occurrences. */
	async availability(em: EntityManager, sources?: ReadonlyArray<Pick<Source, 'id'>>): Promise<Array<Entry>> {
		const ids = (sources ?? await em.find(Source, { integrationId: this.id, enabled: true })).map(source => source.id)
		return !ids.length ? [] : em.find(Entry, { sourceId: { $in: ids }, type: EntryType.Availability, recurrenceMasterId: null })
	}

	/**
	 * Hands the engine all the availability in this integration's calendars, or `entries` instead, for a change that
	 * reaches beyond one entry: a calendar turned on or off, the account disconnected, a sync repairing it.
	 * What reaches the provider is up to the engine; the default does nothing. @returns whether anything changed.
	 */
	publishAvailability(em: EntityManager, entries?: ReadonlyArray<Entry>): Promise<boolean> {
		const engine = engines.get(this.type)
		return !engine?.publishAvailability ? Promise.resolve(false)
			: Integration.exclusively(this.id, async () => engine.publishAvailability!(this, em, entries ?? await this.availability(em)))
	}
}

type IntegrationConstructor = new (init?: any) => Integration

export interface IntegrationClass extends IntegrationConstructor {
	readonly type: string
	readonly label: string
	readonly logo: string
	readonly description: string
	readonly onePerUser: boolean
	readonly developmentOnly: boolean
	readonly discoversSources: boolean
}

const registeredIntegrations = new Map<string, IntegrationClass>()

/**
 * Registers an Integration class with its discriminator type and metadata.
 */
export function integration(type: string) {
	return (target: IntegrationConstructor) => {
		entity({ discriminatorValue: type })(target as any)
		Object.defineProperty(target, 'type', { value: type })
		registeredIntegrations.set(type, target as unknown as IntegrationClass)
	}
}

export function integrationClassFor(type: string | undefined): IntegrationClass {
	const target = type ? registeredIntegrations.get(type) : undefined
	if (!target) {
		throw new Error(`Unknown integration type: ${type ?? '(none)'}`)
	}
	return target
}

export function integrationClasses(): Array<IntegrationClass> {
	return [...registeredIntegrations.values()]
}
