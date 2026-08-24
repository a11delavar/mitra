import type { EntityManager, FilterQuery } from '@mikro-orm/core'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, manyToOne, embedded, unique } from '../../infrastructure/model/orm.js'
import { Identity, type IdentityClaims } from './Identity.js'
import { Source } from '../sources/Source.js'
import { Integration } from '../../integrations/Integration.js'
import { Entry } from '../entries/Entry.js'

/** An ADDITIONAL time zone shown in the day grid's time axis: the IANA id plus an optional short
 * custom label ("DE"). The system time zone is not on this list — it anchors the grid itself and is
 * always the column adjacent to the days. */
export interface UserTimeZone {
	id: string
	label?: string
}

@model('User')
@entity()
@unique({ properties: ['identity.issuer', 'identity.subject'] })
export class User {
	static readonly default = new User({ username: '[default_local_user]' })

	@primaryKey() id: string = crypto.randomUUID()
	@property({ type: 'string', unique: true }) username!: string

	// The OIDC identity this user signs in as; absent in single-user mode (see Identity).
	@embedded(() => Identity, { prefix: 'oidc_', nullable: true }) identity?: Identity

	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'set null', nullable: true }) defaultSourceId?: string

	@property({ type: 'json', nullable: true }) timeZones?: Array<UserTimeZone>

	/** The app version whose release notes this user last saw (What's-New dialog) — the sidebar's news
	 * dot lights when the running version differs. Null until first recorded, so a fresh user starts
	 * dark: the dot means "the instance moved since you last looked", never "welcome". */
	@property({ type: 'string', nullable: true }) lastSeenVersion?: string

	/**
	 * What to come back to after "Only show this calendar" — the sources that were HIDDEN when the solo
	 * began, not the ones that were visible. Storing the complement means a source that appears mid-solo
	 * comes back shown, instead of being hidden by a record taken before it existed.
	 *
	 * Presence marks the solo, not content: `[]` is the usual case (nothing was hidden) and still means
	 * "soloed", `undefined` means not. So test the array itself, never its length.
	 */
	@property({ type: 'json', nullable: true }) previouslyHiddenSourceIds?: Array<string>

	constructor(init?: Partial<User>) {
		Object.assign(this, init)
	}

	/**
	 * Just-in-time provisioning: resolves an OIDC identity to its local user, creating a fresh one on
	 * first sight. Enabling OIDC on a previously single-user deployment does NOT carry that data over —
	 * every identity, including the first, starts empty and re-adds its own integrations.
	 */
	static async provision(em: EntityManager, issuer: string, claims: IdentityClaims): Promise<User> {
		const existing = await em.findOne(User, { identity: { issuer, subject: claims.sub } })
		if (existing) {
			existing.identity?.applyClaims(claims)
			return existing
		}
		// The username's only job is uniqueness — displays use the identity's `name`/`email`.
		const user = new User({ username: claims.sub, identity: Identity.fromClaims(issuer, claims) })
		em.persist(user)
		return user
	}

	/**
	 * "Only show this calendar" (PUT /sources/:id/solo). `sources` are the ENABLED ones — the rows the
	 * sidebar shows; a disabled source is nobody's business here.
	 *
	 * Two cases record nothing. Soloing while already soloed keeps the FIRST record, so hopping between
	 * calendars still comes back to the visibility the user arranged. And soloing the only calendar
	 * that's on show records nothing at all — there's nothing to come back from.
	 */
	showOnly(sources: ReadonlyArray<Source>, sourceId: string): void {
		const visible = sources.filter(source => source.visible)
		if (!this.previouslyHiddenSourceIds && visible.length === 1 && visible[0]!.id === sourceId) {
			return
		}
		this.previouslyHiddenSourceIds ??= sources.filter(source => source.hidden).map(source => source.id)
		for (const source of sources) {
			source.hidden = source.id !== sourceId
		}
	}

	/** Back out of a solo: hide the recorded sources again, show everything else, spend the record. */
	restorePreviousVisibility(sources: ReadonlyArray<Source>): void {
		const previouslyHidden = new Set(this.previouslyHiddenSourceIds)
		this.previouslyHiddenSourceIds = undefined
		for (const source of sources) {
			source.hidden = previouslyHidden.has(source.id)
		}
	}

	// Ownership-scoped lookups: routes resolve every entity through these, so a foreign id — however
	// guessed — reads as a plain NotFoundError (the central error handler's 404) instead of leaking
	// or mutating another user's data.

	integrations(em: EntityManager): Promise<Array<Integration>> {
		return em.find(Integration, { userId: this.id })
	}

	integration(em: EntityManager, id: string): Promise<Integration> {
		return em.findOneOrFail(Integration, { id, userId: this.id })
	}

	async sources(em: EntityManager, where: FilterQuery<Source> = {}): Promise<Array<Source>> {
		const integrations = await this.integrations(em)
		return em.find(Source, { $and: [where, { integrationId: { $in: integrations.map(integration => integration.id) } }] })
	}

	async source(em: EntityManager, id: string): Promise<Source> {
		const source = await em.findOneOrFail(Source, { id })
		await this.integration(em, source.integrationId) // not ours → NotFoundError → 404
		return source
	}

	async entry(em: EntityManager, id: string): Promise<Entry> {
		const entry = await em.findOneOrFail(Entry, { id })
		await this.source(em, entry.sourceId)
		return entry
	}
}
