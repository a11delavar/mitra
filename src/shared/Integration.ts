import { entity, primaryKey, property, manyToOne, oneToMany, Collection } from './orm.js'
import { User } from './User.js'
import { Source } from './Source.js'
import type { Entry } from './Entry.js'
import type { EntityManager } from '@mikro-orm/core'

@entity({ abstract: true, discriminatorColumn: 'type' })
export abstract class Integration<TConfig extends Record<string, any> = any> {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => User, { mapToPk: true }) userId!: string

	@property({ type: 'string' }) type!: string
	@property({ type: 'json' }) config: TConfig = {} as TConfig

	@oneToMany(() => Source, source => source.integrationId) sources = new Collection<Source>(this)

	/**
	 * Fetches the account's remote sources (e.g. calendars, task lists) as transient
	 * (unpersisted) entities. Internal — callers use {@link getSources}, which reconciles
	 * these against the database.
	 */
	protected abstract fetchSources(): Promise<Array<Source>>

	/** Fetches and stores the entries of a single source. */
	protected abstract syncSourceEntries(em: EntityManager, source: Source): Promise<void>

	/**
	 * Merges the client-supplied `incoming` representation into this integration. Each
	 * provider decides which fields to overwrite and which to preserve — for example,
	 * CalDAV keeps the stored password when `incoming` carries a blank one.
	 */
	abstract merge(incoming: this): void

	/**
	 * Reconciles the persisted source rows against the provider's current sources (via
	 * {@link fetchSources}) and returns the up-to-date list: matching rows are kept — with
	 * their activation state and id intact — and renamed, new sources are added (deactivated),
	 * and ones that vanished remotely are removed (their entries cascade away).
	 *
	 * It mutates the entity manager but does **not** flush, so the caller decides whether the
	 * reconciliation is committed: the editor calls this to preview/refresh the list and simply
	 * discards the (forked) manager, while {@link sync} and {@link applyAndSync} flush to persist.
	 */
	async getSources(em: EntityManager): Promise<Array<Source>> {
		const remote = await this.fetchSources()
		const existing = await em.find(Source, { integrationId: this.id })
		const existingByUrl = new Map(existing.map(source => [source.url, source]))
		const remoteUrls = new Set(remote.map(source => source.url))

		for (const source of existing) {
			if (!remoteUrls.has(source.url)) {
				em.remove(source)
			}
		}

		return remote.map(source => {
			const match = existingByUrl.get(source.url)
			if (!match) {
				source.integrationId = this.id
				em.persist(source)
				return source
			}
			match.name = source.name
			return match
		})
	}

	/** Syncs entries for every currently enabled source. */
	async syncEntries(em: EntityManager): Promise<void> {
		for (const source of await em.find(Source, { integrationId: this.id, enabled: true })) {
			await this.syncSourceEntries(em, source)
		}
	}

	/** Full synchronization: reconcile sources, then sync entries for the enabled ones. */
	async sync(em: EntityManager): Promise<void> {
		await this.getSources(em)
		await this.syncEntries(em)
	}

	/**
	 * Applies the client-supplied `incoming` integration and synchronizes: merges the provider
	 * config (preserving anything the client omitted), reconciles the available sources, activates
	 * the ones selected in `incoming` (matched by url), then syncs entries for the active sources.
	 */
	async applyAndSync(em: EntityManager, incoming: this): Promise<void> {
		this.merge(incoming)
		const sources = await this.getSources(em)

		const enabledUrls = new Set([...(incoming.sources ?? [])].filter(source => source.enabled).map(source => source.url))
		for (const source of sources) {
			source.enabled = enabledUrls.has(source.url)
		}
		await em.flush()

		await this.syncEntries(em)
		await em.flush()
	}

	/**
	 * Creates `entry` on the external source. `entry.sourceId` must already point at a
	 * target source belonging to this integration. Used when an entry is moved to a
	 * source of a different integration.
	 * @returns The created (persisted) entry.
	 */
	abstract createEntry(em: EntityManager, entry: Entry): Promise<Entry>

	/**
	 * Applies the desired state of `incoming` onto the persisted `existing` entry and
	 * pushes the change to the external source. The integration owns the strategy: it
	 * may diff `existing` against `incoming` for efficiency, or rewrite wholesale.
	 * @param em The entity manager to use for database operations.
	 * @param existing The currently persisted entry (managed).
	 * @param incoming A transient entry carrying the edited field values.
	 */
	abstract updateEntry(em: EntityManager, existing: Entry, incoming: Entry): Promise<void>

	/**
	 * Deletes `entry` from the external source and removes it locally.
	 */
	abstract deleteEntry(em: EntityManager, entry: Entry): Promise<void>
}
