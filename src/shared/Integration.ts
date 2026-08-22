import { type Converter } from '@a11d/converter'
import { entity, primaryKey, property, manyToOne, oneToMany, unique, Collection } from './orm.js'
import { User } from './User.js'
import { Source } from './Source.js'
import { Entry } from './Entry.js'
import { EntryRelation } from './EntryRelation.js'
import type { Relation } from './Relation.js'
import { FlushMode, type EntityManager } from '@mikro-orm/core'

/**
 * Converter options for a provider's own `credentials`, naming the fields that AUTHORIZE the account
 * rather than identify it — a CalDAV password, a Notion token, a Google refresh token. Each provider
 * applies this to its own declaration, so one whose shape looks nothing like the others simply names
 * its own fields, and one with no secret at all declares nothing.
 *
 * Only a RESPONSE withholds them; a REQUEST carries them untouched. Deconstruction happens whenever a
 * value leaves a runtime and cannot tell the two apart — but it never has to, because each runtime only
 * sends one way: the browser asks, the server answers. That is what lets a connect deliver the very
 * secret it exists to deliver, while nothing authorizing ever comes back out.
 *
 * Which end this is comes from the BUILD (`mitra.runtime`, baked per bundle in scripts/esbuild.ts), not
 * from anything detected at run time: sniffing for a `window` would answer the same in practice, but it
 * asks what the process CONTAINS — and a process can be made to contain anything — where this asks what
 * the bundle IS, settled before it ever runs.
 *
 * Blanked rather than dropped: that is the shape {@link Integration.merge} reads as "keep the stored
 * one", and the shape the edit form binds to.
 */
export function withheld<TCredentials extends Record<string, any>>(...secrets: Array<keyof TCredentials & string>): Converter<TCredentials, TCredentials> {
	return {
		deconstruct: credentials => mitra.runtime !== 'server' ? credentials : {
			...credentials,
			...Object.fromEntries(secrets.map(secret => [secret, ''])),
		},
	}
}

@entity({ abstract: true, discriminatorColumn: 'type' })
@unique({ properties: ['userId', 'uri'] })
export abstract class Integration<TCredentials extends Record<string, any> = any> {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => User, { mapToPk: true }) userId!: string

	@property({ type: 'string', nullable: true }) uri?: string

	@property({ type: 'string' }) type!: string

	/** A provider whose credentials carry a secret redeclares this with its own {@link withheld}. */
	@property({ type: 'json' }) credentials: TCredentials = {} as TCredentials

	/** Manual sidebar position among the user's integrations (see PUT /integrations/order and
	 * shared/order.ts). Sorted `asc nulls last`: null = never placed by hand — connection order,
	 * after every numbered one. */
	@property({ type: 'number', nullable: true }) order?: number | null

	/** The account's own calendar-user addresses (lowercase e-mails) — what identifies "me" among an
	 * entry's participants. CalDAV discovers them from the principal's calendar-user-address-set
	 * (RFC 6638) during sync, falling back to an e-mail-shaped username. */
	@property({ type: 'json', nullable: true }) addresses?: Array<string>

	@oneToMany(() => Source, source => source.integrationId) sources = new Collection<Source>(this)

	constructor() {
		// Stamp the STI discriminator eagerly: MikroORM only back-populates `type` on load, so without
		// this a freshly constructed instance would neither know nor serialize its own type, and every
		// consumer (the add dialog, POST bodies, logs) would have to remember to set it by hand. The
		// value is the `type` static @integration stamps on the class — `new.target` is the concrete
		// subclass being constructed. Unregistered internal-only subclasses (e.g. Dev) have no such
		// static and stay unstamped here; the ORM writes their discriminator on persist as always.
		const type = (new.target as { type?: string }).type
		if (type) {
			this.type = type
		}
	}

	/**
	 * The minimum time between background sync polls, in milliseconds — 0 means every synchronizer
	 * cycle, `Infinity` means never: the integration is local-only (Dev today; an Obsidian-style
	 * provider tomorrow), its rows live solely in our database, so both the background daemon and
	 * a manual refresh skip it — there is no remote to fetch from. Rate-limited providers (e.g.
	 * Google) override this to poll more politely; the SyncPacer paces each integration
	 * accordingly (fast while the owner has a client connected, slow otherwise, and backing off
	 * further on failures).
	 */
	get syncInterval() { return 0 }

	/**
	 * What the provider's data model can represent. The editor hides the fields a provider can't
	 * hold (see Notion) — an input whose value silently vanishes on save is a lie, and mapping it
	 * anyway would approximate semantics the provider doesn't have. Everything defaults to true;
	 * `cancelledStatus` refers to the fourth task status (to-do/doing/done are universal),
	 * `timeZone` to authoring an entry in a named IANA zone (Notion's date property can't hold one —
	 * its API normalizes any time_zone to a fixed offset and returns time_zone:null),
	 * `participants` to group-scheduling (RFC 5545 ATTENDEE/ORGANIZER — a page/database has no
	 * invitees, so Notion turns it off), `transparency` to whether an event's time counts as busy
	 * (RFC 5545 TRANSP) and `visibility` to its access classification (RFC 5545 CLASS). The last two
	 * are separate flags rather than one "sharing" flag because they are separate facts: a provider
	 * could perfectly well model one and not the other. `relations` is whether the provider has a
	 * NATIVE link store — and the test is the round trip, not the vocabulary: Google's CalDAV accepts
	 * a `RELATED-TO` and hands back an `.ics` without it, which is not a store. It gates the same two
	 * things every capability does: the editor offers no way to author one, and the sync claims no
	 * authority over them (`entry.relations` stays `undefined`, so the rows survive — see
	 * shared/EntryRelation.ts). Lines pointing at such an entry from elsewhere still render on it:
	 * they live on the OTHER entry, which is a different provider's fact, and hiding them would deny
	 * a relationship the calendar is already drawing.
	 * A getter on the class (not serialized state): the frontend's API reviver rehydrates
	 * integrations into these very classes, so both sides read the same declaration.
	 */
	get capabilities() {
		return Integration.fullCapabilities
	}

	/** Everything supported: the base answer, and the right reading for a provider the CLIENT doesn't
	 * model (a plain DTO arrives without the getter — see the frontend's getCapabilities). Declared
	 * once, so a capability added to the class can never be forgotten at that fallback and read as
	 * unsupported. */
	static get fullCapabilities() {
		return { recurrence: true, reminders: true, location: true, description: true, cancelledStatus: true, timeZone: true, participants: true, transparency: true, visibility: true, relations: true }
	}

	/**
	 * Whether the fields entered so far carry enough to attempt source discovery — the add dialog's
	 * Connect button gate. Which inputs a connection needs is the provider's own knowledge, so it lives
	 * here rather than in the dialog: the base needs a server URL and a username (CalDAV's shape),
	 * {@link AppleCalendar} only a username (its URL is fixed), Notion only its token. An EDIT never
	 * consults this — the stored secrets stay server-side, so a refresh is always allowed.
	 */
	get canConnect(): boolean {
		return !!this.uri && !!this.credentials.username
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
	 * A transient copy for the client-side edit form — the mirror image of {@link merge}: same identity
	 * and uri, the credentials as held (already stripped of secrets by the server that sent them — see
	 * {@link withheld}), and sources as a plain array (never a live ORM Collection) so the copy stays
	 * JSON-serializable when sent to the API — a Collection holds a circular owner reference.
	 */
	editableCopy(): this {
		const constructor = this.constructor as new (init?: Partial<Integration>) => this
		return new constructor({
			id: this.id,
			uri: this.uri,
			credentials: { ...this.credentials },
			sources: [...this.sources].map(source => new Source({ uri: source.uri, entryTypes: source.entryTypes, name: source.name, enabled: source.enabled })) as any,
		})
	}

	/**
	 * Reconciles the persisted source rows against the provider's current sources (via
	 * {@link fetchSources}) and returns the up-to-date list: matching rows are kept — with their
	 * activation state, id, and any LOCAL rename intact (a provider rename still propagates; see the
	 * `remoteName` handling below), new sources are added (deactivated), and ones that vanished
	 * remotely are removed (their entries cascade away).
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
				// Record the provider's name so a later reconcile can tell a REMOTE rename apart from a
				// LOCAL one (see below).
				source.remoteName = source.name
				em.persist(source)
				return source
			}
			// The entry types a source accepts are provider truth, never user-edited (unlike `name`), so
			// they simply refresh: a collection whose supported-component-set changed server-side (tasks
			// enabled on a calendar) offers that type from the next reconcile on.
			if (source.entryTypes.length) {
				match.entryTypes = source.entryTypes
			}
			// Follow a REMOTE rename, but never clobber a LOCAL one. `remoteName` is the provider's name
			// as of the last reconcile.
			if (match.remoteName === null || match.remoteName === undefined) {
				// Baseline unknown — a row that predates this column, so we can't tell an intentional
				// local name from a stale one. Record the provider's name as the baseline WITHOUT
				// touching the displayed name, so an existing rename is preserved (erring toward what
				// the user currently sees). From here on the comparison below governs.
				match.remoteName = source.name
			} else if (source.name !== match.remoteName) {
				// The provider's name changed since the last reconcile — a remote rename. Adopt it (a
				// local custom name yields to it); an unchanged provider name leaves the row's current
				// name alone, which may be one the user set via PUT /sources/:id/name.
				match.name = source.name
				match.remoteName = source.name
			}
			return match
		})
	}

	/**
	 * Mirrors native-parsed relationships into the {@link EntryRelation} store. The provider contract:
	 * an integration with a NATIVE link store (CalDAV's `RELATED-TO`) parses a definite
	 * `entry.relations` (array or `null`) in {@link syncSourceEntries} and writes it natively in
	 * {@link createEntry}/{@link updateEntry}; one without leaves the field `undefined` on sync and
	 * ignores it on writes — those rows stay untouched, the table itself being the store. Does not
	 * flush; the mirror commits with the sync's own flush.
	 */
	protected async reconcileRelations(em: EntityManager, entries: Iterable<Entry>): Promise<void> {
		const byEntryId = new Map<string, Array<Relation> | null>()
		for (const entry of entries) {
			if (entry.id && entry.relations !== undefined) {
				byEntryId.set(entry.id, entry.relations)
			}
		}
		await EntryRelation.reconcileAll(em, byEntryId)
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
	 *
	 * Deliberately NOT called "resync": {@link sync} is the incremental pull that runs constantly,
	 * and "sync again" is exactly what that already is. The two are different operations — one
	 * fetches deltas, the other throws the cache away — so they get different words, in the code
	 * as in the UI.
	 */
	async reimportSource(em: EntityManager, source: Source): Promise<void> {
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
		// its sources are plain objects with no getters) — match them by the plain `uri` field, a source's identity.
		const enabledKeys = new Set([...(incoming.sources ?? [])].filter(source => source.enabled).map(source => source.uri))
		for (const source of sources) {
			source.enabled = enabledKeys.has(source.uri)
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
	 * absent (undefined) keeps them untouched. `incoming.relations` is tri-state the same way
	 * (array sets, `null` clears, undefined keeps); callers populate `existing.relations` from
	 * the store beforehand so a diffing provider can compare.
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

/**
 * A connectable integration subclass: its constructor plus the presentation metadata the add dialog's
 * type-select step renders from. Each concrete provider declares these as statics, so a provider owns
 * its own identity in one place — its class — and adding one is a new class (plus its logo asset), not
 * an edit to a list somewhere else. The domain classes double as the frontend's API models (see
 * AGENTS.md), so this stays plain data: no lit templates or `t()` (which would drag the view layer /
 * a frontend-only global into shared/backend code) — the logo is an asset key, the description English
 * source text the dialog localizes at render.
 */
export interface IntegrationClass extends IntegrationConstructor {
	/** The discriminator `type`, stamped by {@link integration}; also what a fresh instance self-stamps. */
	readonly type: string
	/** The service name — its tile title and the details-step heading. A brand name; not localized. */
	readonly label: string
	/** Names the tile's logo asset (resolved to the inlined SVG by the dialog's logo map). */
	readonly logo: string
	/** One line on what connecting brings in — English source text, localized at render. */
	readonly description: string
}

// The connectable subclasses, keyed by discriminator `type`, in registration (= display) order. ONE map
// serves everything: {@link integrationClassFor}'s type→class dispatch (API + backend), {@link
// integrationClasses}' tile list (add dialog), and — via the `type` static @integration stamps onto the
// class — a fresh instance's discriminator self-stamp. Internal-only subclasses (e.g. Dev) keep the
// plain `@entity` and stay out, so a stray `type` on the wire can never instantiate one.
const registeredIntegrations = new Map<string, IntegrationClass>()

/**
 * Declares a concrete {@link Integration} subclass's discriminator `type`: sets the MikroORM
 * discriminator value, stamps the class with a `type` static (so instances self-stamp and the constructor
 * needs no per-class wiring), and registers it. Use in place of a bare `@entity({ discriminatorValue })`
 * — they always travelled together, and keeping them apart let the string drift and forced the API layer
 * to hand-roll its own type→class dispatch.
 */
export function integration(type: string) {
	return (target: IntegrationConstructor) => {
		entity({ discriminatorValue: type })(target as any)
		Object.defineProperty(target, 'type', { value: type })
		registeredIntegrations.set(type, target as unknown as IntegrationClass)
	}
}

/** The concrete {@link Integration} subclass a client-supplied discriminator `type` maps to. Throws on
 * an unknown (or internal-only) type rather than silently defaulting to one particular provider. */
export function integrationClassFor(type: string | undefined): IntegrationClass {
	const target = type ? registeredIntegrations.get(type) : undefined
	if (!target) {
		throw new Error(`Unknown integration type: ${type ?? '(none)'}`)
	}
	return target
}

/** The connectable integration classes in display order — the source for the add dialog's tiles. */
export function integrationClasses(): Array<IntegrationClass> {
	return [...registeredIntegrations.values()]
}
