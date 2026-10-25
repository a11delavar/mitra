import { converter } from '@a11d/converter'
import { FlushMode, type EntityManager } from '@mikro-orm/core'
import { User } from '#features/identity'
import { Source } from '#features/sources'
import { Entry, EntryType } from '#features/entries'
import { entity, primaryKey, property, manyToOne, unique, children, Entity, identity, equality } from '#infrastructure/model'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { IntegrationCapabilities } from './IntegrationCapabilities.js'
import { IntegrationOwnership } from './IntegrationOwnership.js'

/** Protocol sync and CRUD operations registered per integration type, which reads its changes as one of the two below. */
export interface SyncEngine {
	/** Fetches remote sources, optionally passing existing persisted sources for conditional requests. */
	fetchSources(integration: Integration, existing?: ReadonlyArray<Source>): Promise<Array<Source>>
	createEntry(integration: Integration, em: EntityManager, entry: Entry): Promise<Entry>
	updateEntry(integration: Integration, em: EntityManager, existing: Entry, incoming: Entry): Promise<void>
	deleteEntry(integration: Integration, em: EntityManager, entry: Entry): Promise<void>
	excludeOccurrence(integration: Integration, em: EntityManager, master: Entry, recurrenceId: Date): Promise<void>
	createSource?(integration: Integration, em: EntityManager, source: Source): Promise<Source>
	deleteSource?(integration: Integration, em: EntityManager, source: Source): Promise<void>
	/** Brings what the provider holds for availability in line with `entries`: all of it, or only what stands for the entries in `of`. */
	publishAvailability?(integration: Integration, em: EntityManager, entries: ReadonlyArray<Entry>, of?: ReadonlyArray<Entry>): Promise<boolean>
}

/** An engine whose provider tells its changes per calendar (a CalDAV sync token, a Notion watermark), read one calendar at a time. */
export interface SourceSyncEngine extends SyncEngine {
	/** @returns whether any entry of the calendar changed. */
	syncSourceEntries(integration: Integration, em: EntityManager, source: Source): Promise<boolean>
}

/** An engine whose provider tells its changes per account (Todoist's sync token), read for every enabled calendar at once. */
export interface AccountSyncEngine extends SyncEngine {
	/** @returns whether any entry changed. */
	syncAccountEntries(integration: Integration, em: EntityManager, sources: ReadonlyArray<Source>): Promise<boolean>
}

type AnySyncEngine = SourceSyncEngine | AccountSyncEngine

const engines = new Map<string, AnySyncEngine>()

export function registerEngine(type: string, engine: AnySyncEngine) {
	engines.set(type, engine)
}

function engineFor(integration: Integration): AnySyncEngine {
	const engine = engines.get(integration.type)
	if (!engine) {
		throw new Error(`No sync engine registered for integration type '${integration.type}'. See integrations/server/registerEngines.ts. This only ever runs server-side, after that file's import.`)
	}
	return engine
}

/** In-flight sync chains serialized per integration id to prevent concurrent duplicate imports. */
const syncChains = new Map<string, Promise<unknown>>()

const logger = createLogger('Integration')

@entity({ abstract: true, discriminatorColumn: 'type' })
@unique({ properties: ['userId', 'uri'] })
export abstract class Integration<TCredentials extends Record<string, any> = any> extends Entity {
	@identity()
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => User, { mapToPk: true }) userId!: string

	@equality()
	@property({ type: 'string', nullable: true }) uri?: string

	@property({ type: 'string' }) type!: string

	/** A name of the user's own, for two accounts signed in as the same person. Only renaming writes it, never a save from the dialog. */
	@equality()
	@property({ type: 'string', nullable: true }) name?: string

	@equality()
	@property({ type: 'json' }) credentials: TCredentials = {} as TCredentials

	/** How it is named wherever it is shown: the user's name for it, else the account it signs in as, else the provider. */
	get title() {
		return this.name || this.credentials?.username || String(t((this.constructor as IntegrationClass).label ?? this.type))
	}

	/** Manual sidebar display order among user's integrations (sorted asc nulls last). */
	@equality()
	@property({ type: 'number', nullable: true }) order?: number | null

	/** Lowercase email addresses representing the user in participant lists (RFC 6638). */
	@equality()
	@property({ type: 'json', nullable: true }) addresses?: Array<string>

	/** Where the provider's account-wide changes were last read up to. Never on the wire. */
	@converter({ in: {}, out: {} })
	@property({ type: 'json', nullable: true }) syncState?: Record<string, any>

	/** Its calendars, as loaded or as given (a request, the browser's store). Never saved through here: a calendar is a row of its own. */
	@equality()
	@children(() => Source, source => source.integrationId, { eager: true })
	@converter({
		construct: (value: ReadonlyArray<Source> | undefined) => value ?? [],
		deconstruct: (value: ReadonlyArray<Source>) => [...value],
	}) sources!: ReadonlyArray<Source>

	constructor() {
		super()
		const type = (new.target as { type?: string }).type
		if (type) {
			this.type = type
		}
	}

	/** Minimum time between background sync polls in ms (0 = every cycle, Infinity = local only). */
	get syncInterval() { return 0 }

	get capabilities() {
		return new IntegrationCapabilities()
	}

	/** Which fields of its entries it holds and who owns each: an integration declares its own, as none are assumed. */
	get ownership() {
		return new IntegrationOwnership({ rank: 'mitra' })
	}

	/** Optional icon override for this integration's sources (e.g. 'rss' for subscriptions). */
	get sourceIcon(): string | undefined { return undefined }

	/** Whether re-import can rebuild the entries from somewhere. */
	get reimportable() { return true }

	static readonly onePerUser: boolean = false

	/** Offered only on a development system (`MITRA_DEV`). */
	static readonly developmentOnly: boolean = false

	/** False when connecting finds nothing, so the first source is created instead. */
	static readonly discoversSources: boolean = true

	/** Its page of the documentation (`integrations/apple`), which the dialog connecting it links. */
	static readonly docs: string | undefined = undefined

	/** Returns effective capabilities for a specific source, masking write capabilities if read-only. */
	capabilitiesFor(source: Pick<Source, 'readOnly'> | undefined) {
		return this.capabilities.in(source)
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
	 * The account's remote sources as transient entities; callers use {@link getSources}, which reconciles them.
	 * A subclass with no engine (Notion, Mitra) overrides this.
	 */
	protected fetchSources(existing?: ReadonlyArray<Source>): Promise<Array<Source>> {
		return engineFor(this).fetchSources(this, existing)
	}

	/**
	 * @returns whether any entry changed. A subclass with no engine (Notion, Mitra) overrides this. Reached only through
	 * {@link syncSources}, which sends an account engine the other way.
	 */
	protected syncSourceEntries(em: EntityManager, source: Source): Promise<boolean> {
		return (engineFor(this) as SourceSyncEngine).syncSourceEntries(this, em, source)
	}

	/** Each provider decides which fields to keep, e.g. CalDAV keeps the stored password when `incoming` carries a blank one. */
	abstract merge(incoming: this): void

	/**
	 * Reconciles persisted sources with the provider, adding new ones disabled and removing obsolete ones, matched by
	 * address however the provider spells it. A listing of none keeps them all, and every change is logged.
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

		// An account that had calendars and lists none answered in error: Google signs in with an access token that expires
		// hourly, and a refused listing reads as no calendars. Removing them would take their entries along.
		if (!remote.length && existing.length) {
			logger.warn(`${this.toString()} listed no calendars; keeping its ${existing.length} stored calendar(s)`)
			return existing
		}

		// By address: the provider's list is of calendars, not of Mitra's rows.
		for (const source of existing) {
			if (!remote.some(candidate => source.isAt(candidate.uri))) {
				logger.info(`Removed calendar "${source.name}" (${source.uri}) from ${this.toString()}: the provider no longer lists it`)
				em.remove(source)
			}
		}

		return remote.map(source => {
			const match = existing.find(candidate => candidate.isAt(source.uri))
			if (!match) {
				source.integrationId = this.id
				source.remoteName = source.name
				em.persist(source)
				logger.info(`Added calendar "${source.name}" (${source.uri}) to ${this.toString()}, ${source.enabled ? 'on' : 'off'}`)
				return source
			}
			if (match.uri !== source.uri) {
				logger.info(`Calendar "${match.name}" of ${this.toString()} is now at ${source.uri}, formerly ${match.uri}`)
				match.uri = source.uri
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

	/** One calendar's pass, the importer's. @returns whether entries changed or an import completed. */
	syncSource(em: EntityManager, source: Source): Promise<boolean> {
		return this.syncSources(em, [source])
	}

	/** Every enabled calendar's pass, the synchronizer's. @returns whether anything worth republishing happened. */
	async syncEntries(em: EntityManager): Promise<boolean> {
		return this.syncSources(em, await em.find(Source, { integrationId: this.id, enabled: true }))
	}

	/**
	 * Where the two kinds of engine part: an account engine reads every enabled calendar whichever were asked for, so an
	 * import of one project imports them all. A calendar is marked imported once its pass completes without truncation.
	 */
	private async syncSources(em: EntityManager, requested: ReadonlyArray<Source>): Promise<boolean> {
		const imported = (source: Source) => !source.syncState?.incomplete && source.markImported()
		const engine = engines.get(this.type)
		if (engine && 'syncAccountEntries' in engine) {
			const sources = await em.find(Source, { integrationId: this.id, enabled: true })
			const changed = await engine.syncAccountEntries(this, em, sources)
			return sources.map(imported).some(Boolean) || changed
		}
		let changed = false
		for (const source of requested) {
			const read = await this.syncSourceEntries(em, source)
			changed = imported(source) || read || changed
		}
		return changed
	}

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

	/** Runs `work` holding the locks of several integrations, taken in sorted order to prevent deadlocks. */
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

	/** Applies credentials and the source selection without waiting for the entry import. */
	apply(em: EntityManager, incoming: this): Promise<void> {
		return Integration.exclusively(this.id, () => this.applyExclusively(em, incoming))
	}

	private async applyExclusively(em: EntityManager, incoming: this): Promise<void> {
		this.merge(incoming)
		const sources = await this.getSources(em, { checkDuplicate: true })

		for (const source of sources) {
			source.enabled = incoming.sources.some(given => given.enabled && given.uri === source.uri)
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
		existing.equate(incoming)
		// An occurrence's deletion excludes its date through the edit; the rule's other bookkeeping is the row's own.
		existing.exdates = incoming.exdates ?? existing.exdates
		// Mitra's own: an edit carrying relations sets them, one without leaves the rows as they are.
		if (incoming.relations !== undefined) {
			existing.relations = incoming.relations
		}
		await this.stored(em, existing)
	}

	async deleteEntry(em: EntityManager, entry: Entry): Promise<void> {
		if (!this.storesLocally(entry)) {
			return engineFor(this).deleteEntry(this, em, entry)
		}
		em.remove(entry)
		await this.stored(em, entry, { removed: true })
	}

	/** Excludes a single occurrence of a recurring master (RFC 5545 EXDATE). */
	async excludeOccurrence(em: EntityManager, master: Entry, recurrenceId: Date): Promise<void> {
		if (!this.storesLocally(master)) {
			return engineFor(this).excludeOccurrence(this, em, master, recurrenceId)
		}
		master.exclude(recurrenceId)
		await this.stored(em, master)
	}

	/**
	 * Availability may stand for something at the provider (CalDAV's busy copy), so the engine hears of every change
	 * to an entry Mitra stores. Runs without the lock, as any entry write.
	 */
	private async stored(em: EntityManager, entry: Entry, { removed = false } = {}) {
		const engine = engines.get(this.type)
		if (entry.type.isAvailability && engine?.publishAvailability) {
			await engine.publishAvailability(this, em, removed ? [] : [entry], [entry])
		}
	}

	/** Routes check `capabilities.sources.create` first; the throw is only a safety net. */
	createSource(em: EntityManager, source: Source): Promise<Source> {
		const engine = engineFor(this)
		if (!engine.createSource) {
			throw new Error(`Integration type '${this.type}' declares createSources but its sync engine implements no createSource`)
		}
		return engine.createSource(this, em, source)
	}

	/** Deletes the source and its entries. Routes check `capabilities.sources.delete` first. */
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
		return !ids.length ? [] : em.find(Entry, { sourceId: { $in: ids }, type: EntryType.Availability, recurringEntryId: null })
	}

	/**
	 * Hands the engine all the availability in this integration's calendars, or `entries`, for a change beyond one entry
	 * (a calendar toggled, the account disconnected, a sync repair). @returns whether anything changed.
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
	readonly docs: string | undefined
}

const registeredIntegrations = new Map<string, IntegrationClass>()

/** Registers an Integration class with its discriminator type and metadata. */
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
