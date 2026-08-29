import type { EntityManager, FilterQuery } from '@mikro-orm/core'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, manyToOne, embedded, unique } from '../../infrastructure/model/orm.js'
import { Identity, type IdentityClaims } from './Identity.js'
import { Source } from '../sources/Source.js'
import { Integration } from '../../integrations/Integration.js'
import { Entry } from '../entries/Entry.js'
import { UserSettings } from '../settings/UserSettings.js'

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

	@embedded(() => Identity, { prefix: 'oidc_', nullable: true }) identity?: Identity

	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'set null', nullable: true }) defaultSourceId?: string

	@property({ type: 'json', nullable: true }) timeZones?: Array<UserTimeZone>

	@property({ type: 'json', nullable: true }) settings?: UserSettings

	@property({ type: 'string', nullable: true }) lastSeenVersion?: string

	/** Sources hidden before a solo view began; presence marks an active solo. */
	@property({ type: 'json', nullable: true }) previouslyHiddenSourceIds?: Array<string>

	constructor(init?: Partial<User>) {
		Object.assign(this, init)
	}

	/** JIT provisions an OIDC user on first login or updates existing identity profile claims. */
	static async provision(em: EntityManager, issuer: string, claims: IdentityClaims): Promise<User> {
		const existing = await em.findOne(User, { identity: { issuer, subject: claims.sub } })
		if (existing) {
			existing.identity?.applyClaims(claims)
			return existing
		}
		const user = new User({ username: claims.sub, identity: Identity.fromClaims(issuer, claims) })
		em.persist(user)
		return user
	}

	/** Replaces stored settings with sanitized preferences bag. */
	applySettings(settings: unknown): void {
		this.settings = UserSettings.sanitize(settings)
	}

	/**
	 * Hides all enabled sources except the chosen sourceId, storing previously hidden sources for restoration.
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

	/** Restores source visibility to the state prior to soloing and clears the solo record. */
	restorePreviousVisibility(sources: ReadonlyArray<Source>): void {
		const previouslyHidden = new Set(this.previouslyHiddenSourceIds)
		this.previouslyHiddenSourceIds = undefined
		for (const source of sources) {
			source.hidden = previouslyHidden.has(source.id)
		}
	}

	// --- Scoped Lookups ---------------------------------------------------------------------------

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
		await this.integration(em, source.integrationId)
		return source
	}

	async entry(em: EntityManager, id: string): Promise<Entry> {
		const entry = await em.findOneOrFail(Entry, { id })
		await this.source(em, entry.sourceId)
		return entry
	}
}
