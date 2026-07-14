import { entity, primaryKey, property, manyToOne, oneToMany, unique, Collection } from './orm.js'
import { User } from './User.js'
import { Source } from './Source.js'
import { Entry } from './Entry.js'
import { FlushMode, type EntityManager } from '@mikro-orm/core'

@entity({ abstract: true, discriminatorColumn: 'type' })
@unique({ properties: ['userId', 'uri'] })
export abstract class Integration<TCredentials extends Record<string, any> = any> {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => User, { mapToPk: true }) userId!: string

	@property({ type: 'string', nullable: true }) uri?: string

	@property({ type: 'string' }) type!: string
	@property({ type: 'json' }) credentials: TCredentials = {} as TCredentials

	@oneToMany(() => Source, source => source.integrationId) sources = new Collection<Source>(this)

	/**
	 * The minimum time between background sync polls, in milliseconds — 0 means every synchronizer
	 * cycle. Rate-limited providers (e.g. Google) override this to poll more politely; the
	 * {@link Synchronizer} paces each integration accordingly (and backs off further on failures).
	 */
	get syncInterval() { return 0 }

	/**
	 * What the provider's data model can represent. The editor hides the fields a provider can't
	 * hold (see Notion) — an input whose value silently vanishes on save is a lie, and mapping it
	 * anyway would approximate semantics the provider doesn't have. Everything defaults to true;
	 * `cancelledStatus` refers to the fourth task status (to-do/doing/done are universal), and
	 * `timeZone` to authoring an entry in a named IANA zone (Notion's date property can't hold one —
	 * its API normalizes any time_zone to a fixed offset and returns time_zone:null).
	 * A getter on the class (not serialized state): the frontend's API reviver rehydrates
	 * integrations into these very classes, so both sides read the same declaration.
	 */
	get capabilities() {
		return { recurrence: true, reminders: true, location: true, description: true, cancelledStatus: true, timeZone: true }
	}

	/**
	 * Fetches the account's remote sources (e.g. calendars, task lists) as transient
	 * (unpersisted) entities. Internal — callers use {@link getSources}, which reconciles
	 * these against the database.
	 */
	protected abstract fetchSources(): Promise<Array<Source>>

	/** Fetches and stores the entries of a single source. @returns whether any entry changed. */
	protected abstract syncSourceEntries(em: EntityManager, source: Source): Promise<boolean>

	/**
	 * Merges the client-supplied `incoming` representation into this integration. Each
	 * provider decides which fields to overwrite and which to preserve — for example,
	 * CalDAV keeps the stored password when `incoming` carries a blank one.
	 */
	abstract merge(incoming: this): void

	/**
	 * A transient copy for the client-side edit form — the mirror image of {@link merge}: same
	 * identity and uri, credentials as the form should see them (see {@link editableCredentials}),
	 * and sources as a plain array (never a live ORM Collection) so the copy stays
	 * JSON-serializable when sent to the API — a Collection holds a circular owner reference.
	 */
	editableCopy(): this {
		const constructor = this.constructor as new (init?: Partial<Integration>) => this
		return new constructor({
			id: this.id,
			uri: this.uri,
			credentials: this.editableCredentials,
			sources: [...this.sources].map(source => new Source({ uri: source.uri, type: source.type, name: source.name, enabled: source.enabled })) as any,
		})
	}

	/** The credentials as the edit form should see them: identifying fields kept, secrets blanked —
	 * `merge` treats a blank secret as "keep the stored one", so the form round-trips safely. */
	protected get editableCredentials(): TCredentials {
		return { ...this.credentials }
	}

	/**
	 * Reconciles the persisted source rows against the provider's current sources (via
	 * {@link fetchSources}) and returns the up-to-date list: matching rows are kept — with
	 * their activation state and id intact — and renamed, new sources are added (deactivated),
	 * and ones that vanished remotely are removed (their entries cascade away).
	 *
	 * It mutates the entity manager but does **not** flush, so the caller decides whether the
	 * reconciliation is committed: the editor calls this to preview/refresh the list and simply
	 * discards the (forked) manager, while {@link sync} and {@link applyAndSync} flush to persist.
	 *
	 * `checkDuplicate` guards against connecting an already-connected account — only meaningful when
	 * ADDING (or previewing an add), so {@link applyAndSync} passes it; the background {@link sync}
	 * does not, keeping the extra query off the every-cycle hot path (an already-persisted
	 * integration can never find a duplicate of itself anyway — the DB `(userId, uri)` unique index
	 * already holds).
	 */
	async getSources(em: EntityManager, options?: { checkDuplicate?: boolean }): Promise<Array<Source>> {
		const remote = await this.fetchSources()

		// Providers that derive their identity during discovery (Notion's bot user, Apple's fixed
		// server) can collide with an already-connected account only NOW, when `uri` is known.
		// Failing here turns what would otherwise be a raw UNIQUE-constraint crash into an
		// actionable message. The deferred flush mode matters: this very entity may be a pending
		// insert, and the default smart flush would slam it into the unique index by running this query.
		if (options?.checkDuplicate && this.uri) {
			const duplicate = await em.findOne(Integration, { userId: this.userId, uri: this.uri, id: { $ne: this.id } }, { flushMode: FlushMode.COMMIT })
			if (duplicate) {
				throw new Error('This account is already connected — edit the existing integration instead of adding it again')
			}
		}

		const existing = await em.find(Source, { integrationId: this.id })
		const existingByKey = new Map(existing.map(source => [source.key, source]))
		const remoteKeys = new Set(remote.map(source => source.key))

		for (const source of existing) {
			if (!remoteKeys.has(source.key)) {
				em.remove(source)
			}
		}

		return remote.map(source => {
			const match = existingByKey.get(source.key)
			if (!match) {
				source.integrationId = this.id
				em.persist(source)
				return source
			}
			match.name = source.name
			return match
		})
	}

	/**
	 * Syncs entries for every currently enabled source.
	 * @returns whether any entry changed.
	 */
	async syncEntries(em: EntityManager): Promise<boolean> {
		let changed = false
		for (const source of await em.find(Source, { integrationId: this.id, enabled: true })) {
			if (await this.syncSourceEntries(em, source)) {
				changed = true
			}
		}
		return changed
	}

	/**
	 * Full synchronization: reconcile sources, then sync entries for the enabled ones.
	 * @returns whether any entry changed. Source bookkeeping (e.g. sync tokens) is deliberately
	 * not reported, so idle polls don't notify clients.
	 */
	async sync(em: EntityManager): Promise<boolean> {
		await this.getSources(em)
		return this.syncEntries(em)
	}

	/**
	 * Full re-import of one source: wipes its locally cached entries and its incremental-sync
	 * bookkeeping, then syncs from scratch, rebuilding the local cache to exactly mirror the
	 * provider. The remote source is never touched — this is a cache rebuild, not a data
	 * operation — which is what makes it a safe recovery hatch for a locally-corrupted or
	 * out-of-shape cache (a user-triggered "re-import", or a programmatic one after a breaking
	 * schema change). Integrations whose sources have no external counterpart override this to
	 * a no-op: with nothing to re-import from, wiping would be plain deletion.
	 */
	async resyncSource(em: EntityManager, source: Source): Promise<void> {
		const entries = await em.find(Entry, { sourceId: source.id })
		entries.forEach(entry => em.remove(entry))
		source.syncState = undefined
		await em.flush()
		await this.syncSourceEntries(em, source)
	}

	/**
	 * Applies the client-supplied `incoming` integration and synchronizes: merges the provider
	 * credentials (preserving anything the client omitted), reconciles the available sources, activates
	 * the ones selected in `incoming` (matched by url), then syncs entries for the active sources.
	 */
	async applyAndSync(em: EntityManager, incoming: this): Promise<void> {
		this.merge(incoming)
		const sources = await this.getSources(em, { checkDuplicate: true }) // checkDuplicate: reject re-connecting an already-connected account

		// `incoming` is a client DTO, not a rehydrated entity (`@a11d/api` structure-clones the body, so
		// its sources are plain objects with no `key` getter) — key them via the static, not `source.key`.
		const enabledKeys = new Set([...(incoming.sources ?? [])].filter(source => source.enabled).map(source => Source.keyOf(source)))
		for (const source of sources) {
			source.enabled = enabledKeys.has(source.key)
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
	 * `incoming.exdates` is tri-state: an array replaces the stored exclusions wholesale
	 * (a scoped series edit shifts them along with the series — see backend/occurrences.ts),
	 * absent (undefined) keeps them untouched.
	 * @param em The entity manager to use for database operations.
	 * @param existing The currently persisted entry (managed).
	 * @param incoming A transient entry carrying the edited field values.
	 */
	abstract updateEntry(em: EntityManager, existing: Entry, incoming: Entry): Promise<void>

	/**
	 * Deletes `entry` from the external source and removes it locally.
	 */
	abstract deleteEntry(em: EntityManager, entry: Entry): Promise<void>

	/**
	 * Excludes a single occurrence of a recurring `master` (RFC 5545 EXDATE) — the primitive behind
	 * "delete this occurrence" and behind detaching an edited one. CalDAV writes an EXDATE into the
	 * master's .ics; the local Dev calendar records the excluded instant in the master's `exdates`
	 * column (which the occurrence expansion honours). Does not flush.
	 */
	abstract excludeOccurrence(em: EntityManager, master: Entry, recurrenceId: Date): Promise<void>
}

/** Constructs an {@link Integration} subclass from a `Partial` of its own shape. */
type IntegrationConstructor = new (init?: any) => Integration

// Discriminator `type` → concrete subclass, populated by @integrationType at class-definition time.
// One declaration serves both the MikroORM discriminator and the API's need to instantiate the right
// subclass from a client-supplied `type`, so the type string lives in exactly one place per provider.
const integrationClasses = new Map<string, IntegrationConstructor>()

/**
 * Declares a concrete {@link Integration} subclass's discriminator `type`: sets the MikroORM
 * discriminator value AND registers the type→class mapping {@link integrationClassFor} resolves. Use in
 * place of a bare `@entity({ discriminatorValue })` — the two always travelled together, and keeping
 * them apart let the string drift and forced the API layer to hand-roll its own type→class dispatch.
 * Internal-only integrations a client can't create (e.g. Dev) keep the plain `@entity` and stay out of
 * the registry, so a stray `type` on the wire can never instantiate one.
 */
export function integration(type: string) {
	return (target: IntegrationConstructor) => {
		entity({ discriminatorValue: type })(target as any)
		integrationClasses.set(type, target)
	}
}

/** The concrete {@link Integration} subclass a client-supplied discriminator `type` maps to. Throws on
 * an unknown (or internal-only) type rather than silently defaulting to one particular provider. */
export function integrationClassFor(type: string | undefined): IntegrationConstructor {
	const target = type ? integrationClasses.get(type) : undefined
	if (!target) {
		throw new Error(`Unknown integration type: ${type ?? '(none)'}`)
	}
	return target
}
