import { converter } from '@a11d/converter'
import type { EntityManager, FilterQuery } from '@mikro-orm/core'
import { Source } from '#features/sources'
import { Entry, type EntryType } from '#features/entries'
import { EntryRelation, EntryRelations, RelationGraph } from '#features/relations'
import { UserSettings } from '#features/settings/UserSettings.js'
import { ReminderDefaults } from '#features/reminders/ReminderDefaults.js'
import { UserTimeZones } from '#features/time/UserTimeZones.js'
import { Integration } from '#integrations'
import { model, entity, primaryKey, property, manyToOne, embedded, unique } from '#infrastructure/model'
import { ValidationError } from '#infrastructure/validation'
import { Identity, type IdentityClaims } from './Identity.js'

@model('User')
@entity()
@unique({ properties: ['identity.issuer', 'identity.subject'] })
export class User {
	static readonly default = new User({ username: '[default_local_user]' })

	@primaryKey() id: string = crypto.randomUUID()
	@property({ type: 'string', unique: true }) username!: string

	@embedded(() => Identity, { prefix: 'oidc_', nullable: true }) identity?: Identity

	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'set null', nullable: true }) defaultSourceId?: string

	@converter(UserTimeZones.converter)
	@property({ type: UserTimeZones.Mapper, nullable: true }) timeZones?: UserTimeZones

	@property({ type: 'json', nullable: true }) settings?: UserSettings

	@property({ type: 'string', nullable: true }) lastSeenVersion?: string

	/** Sources hidden before a solo view began; presence marks an active solo. */
	@property({ type: 'json', nullable: true }) previouslyHiddenSourceIds?: Array<string>

	constructor(init?: Partial<User>) {
		Object.assign(this, init)
	}

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

	hasSeen(version: string) {
		return this.lastSeenVersion === version
	}

	/** Whether `version` is news to the user, who saw an earlier release. A new account has nothing to catch up on. */
	hasMissed(version: string) {
		return !!this.lastSeenVersion && !this.hasSeen(version)
	}

	/** The reminders a new entry of the user's starts with. */
	get reminderDefaults() {
		return ReminderDefaults.of(this.settings)
	}

	applySettings(settings: unknown): void {
		this.settings = UserSettings.sanitize(settings)
	}

	/** Keeps the visibility from before the first solo, however many follow. */
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

	restorePreviousVisibility(sources: ReadonlyArray<Source>): void {
		const previouslyHidden = new Set(this.previouslyHiddenSourceIds)
		this.previouslyHiddenSourceIds = undefined
		for (const source of sources) {
			source.hidden = previouslyHidden.has(source.id)
		}
	}

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

	/** Where a new entry of `type` goes when none is named: the default calendar, else the first that takes it. */
	async defaultSource(em: EntityManager, type?: EntryType) {
		const sources = await this.sources(em, { enabled: true })
		const takes = (source: Source) => source.writable && (!type || source.canHold(type))
		const found = sources.find(source => source.id === this.defaultSourceId && takes(source)) ?? sources.find(takes)
		if (!found) {
			throw new ValidationError('No calendar can take this entry', ['sourceId'])
		}
		return found
	}

	async entry(em: EntityManager, id: string): Promise<Entry> {
		const entry = await em.findOneOrFail(Entry, { id })
		await this.source(em, entry.sourceId)
		return entry
	}

	/**
	 * The user's relations whole, over the entries at both ends of each, and the entries `reaching` points at besides: the
	 * graph a read serves and a candidate list is judged on. The rows of the user's own entries only: another user's link
	 * to a uid they share is not the user's to see.
	 */
	async relationGraph(em: EntityManager, reaching = EntryRelations.none) {
		const sourceIds = (await this.sources(em)).map(source => source.id)
		if (!sourceIds.length) {
			return RelationGraph.empty
		}
		const rows = await em.find(EntryRelation, { entryId: { sourceId: { $in: sourceIds } } } as FilterQuery<EntryRelation>)
		const ownerIds = [...new Set(rows.map(row => row.entryId))]
		const targetUids = [...new Set([...rows.map(row => row.targetUid), ...reaching.all.map(relation => relation.targetUid)])]
		if (!ownerIds.length && !targetUids.length) {
			return RelationGraph.empty
		}
		const [owners, targets] = await Promise.all([
			ownerIds.length ? em.find(Entry, { id: { $in: ownerIds }, recurrenceId: null, sourceId: { $in: sourceIds } }) : [],
			targetUids.length ? em.find(Entry, { uid: { $in: targetUids }, recurrenceId: null, sourceId: { $in: sourceIds } }) : [],
		])
		const rowsByEntry = Map.groupBy(rows, row => row.entryId)
		return RelationGraph.of(new Set([...owners, ...targets]), entry => EntryRelations.of((rowsByEntry.get(entry.id!) ?? []).map(row => row.relation)))
	}
}
