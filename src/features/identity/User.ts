import { converter } from '@a11d/converter'
import type { DateTimeRange } from '@3mo/date-time'
import { NotFoundError, type EntityManager, type FilterQuery } from '@mikro-orm/core'
import { Source } from '#features/sources'
import { Entry, EntryType, TaskStatus } from '#features/entries'
import { EntryRelation, EntryRelations, RelationGraph } from '#features/relations'
import { NotificationSubscription } from '#features/reminders/NotificationSubscription.js'
import { UserSettings } from '#features/settings/UserSettings.js'
import { ReminderDefaults } from '#features/reminders/ReminderDefaults.js'
import { UserTimeZones } from '#features/time/UserTimeZones.js'
import { Integration } from '#integrations'
import { model, entity, primaryKey, property, manyToOne, embedded, unique } from '#infrastructure/model'
import { ValidationError } from '#infrastructure/validation'
import { AccessToken } from './AccessToken.js'
import { Identity, type IdentityClaims } from './Identity.js'

interface EntryFilter {
	readonly range?: DateTimeRange
	readonly search?: string
	readonly where?: FilterQuery<Entry>
	readonly sources?: FilterQuery<Source>
	readonly limit?: number
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

	getIntegrations(em: EntityManager): Promise<Array<Integration>> {
		return em.find(Integration, { userId: this.id })
	}

	getIntegration(em: EntityManager, id: string): Promise<Integration> {
		return em.findOneOrFail(Integration, { id, userId: this.id })
	}

	getSources(em: EntityManager) {
		return this.filterSources(em, {})
	}

	async filterSources(em: EntityManager, where: FilterQuery<Source>): Promise<Array<Source>> {
		const integrations = await this.getIntegrations(em)
		return em.find(Source, { $and: [where, { integrationId: { $in: integrations.map(integration => integration.id) } }] })
	}

	async getSource(em: EntityManager, id: string): Promise<Source> {
		const source = await em.findOneOrFail(Source, { id })
		await this.getIntegration(em, source.integrationId)
		return source
	}

	/** Where a new entry of `type` goes when none is named: the default calendar, else the first that takes it. */
	async getDefaultSource(em: EntityManager, type?: EntryType) {
		const sources = await this.filterSources(em, { enabled: true })
		const takes = (source: Source) => source.writable && (!type || source.canHold(type))
		const found = sources.find(source => source.id === this.defaultSourceId && takes(source)) ?? sources.find(takes)
		if (!found) {
			throw new ValidationError('No calendar can take this entry', ['sourceId'])
		}
		return found
	}

	async getEntry(em: EntityManager, id: string): Promise<Entry> {
		const entry = await em.findOneOrFail(Entry, { id })
		await this.getSource(em, entry.sourceId)
		return entry
	}

	/**
	 * The user's entries in the calendars `sources` names, each with its relations, both directions. A recurring entry comes
	 * once, its overrides inside it, unless `where` names a row or `search` finds one. A `range` takes the one-off entries in
	 * it and every recurring entry whole, and two kinds none can contain, which the planning surface draws: undated entries
	 * and open tasks already past due. A `search` takes those whose words hold it, the newest first.
	 */
	async filterEntries(em: EntityManager, { range, search, where, sources = {}, limit }: EntryFilter = {}) {
		const entries = await em.find(Entry, {
			$and: [
				this.inCalendars(sources),
				where ?? {},
				...range ? [User.inRange(range)] : [],
				...search ? [User.matching(search)] : [],
				...where || search ? [] : [{ recurringEntryId: null }],
			],
		}, { ...search ? { orderBy: { start: 'desc' } } : {}, limit })
		const recurring = entries.filter(entry => entry.recurrence)
		const overrides = recurring.length ? await em.find(Entry, { recurringEntryId: { $in: recurring.map(entry => entry.id!) } }) : []
		const byEntry = Map.groupBy(overrides, override => override.recurringEntryId!)
		for (const entry of recurring) {
			entry.overrides = byEntry.get(entry.id!)
		}
		const graph = await this.getRelationGraph(em)
		graph.attach(entries)
		return entries
	}

	private static inRange({ start, end }: DateTimeRange): FilterQuery<Entry> {
		// Cast because `_type` is private. No status at all counts as open.
		const openTask = {
			_type: EntryType.Task,
			$or: [{ status: null }, { status: { $nin: [TaskStatus.Done, TaskStatus.Cancelled] } }],
		} as unknown as FilterQuery<Entry>
		return {
			$or: [
				{ recurrence: { $ne: null } },
				{ start: { $gte: start, $lte: end } },
				{ end: { $gte: start, $lte: end } },
				{ start: { $lte: start }, end: { $gte: end } },
				{ start: null },
				{ $and: [openTask, { $or: [{ due: { $lt: start } }, { end: { $lt: start } }, { end: null, start: { $lt: start } }] }] },
			],
		}
	}

	private static matching(search: string): FilterQuery<Entry> {
		const term = `%${search.trim()}%`
		return {
			// Availability is background, not something to search for.
			type: { $ne: EntryType.Availability },
			$or: [
				{ heading: { $like: term } },
				{ description: { $like: term } },
				{ location: { $like: term } },
			],
		}
	}

	getDevices(em: EntityManager) {
		return this.filterDevices(em, {})
	}

	/** The user's devices `where` names, the last seen first. */
	filterDevices(em: EntityManager, where: FilterQuery<NotificationSubscription>) {
		return em.find(NotificationSubscription, { $and: [where, { userId: this.id }] }, { orderBy: { lastSeenAt: 'desc' } })
	}

	getDevice(em: EntityManager, id: string) {
		return em.findOneOrFail(NotificationSubscription, { id, userId: this.id }, { failHandler: () => new NotFoundError('No such device') })
	}

	getAccessTokens(em: EntityManager) {
		return this.filterAccessTokens(em, {})
	}

	/** The user's access tokens `where` names, the newest first. */
	filterAccessTokens(em: EntityManager, where: FilterQuery<AccessToken>) {
		return em.find(AccessToken, { $and: [where, { userId: this.id }] }, { orderBy: { createdAt: 'desc' } })
	}

	/** Points the user's links from the old uids to the new ones (`uids`), only those of `entryIds` when given: another user's links to a shared uid are not the user's to change. */
	repointRelations(em: EntityManager, uids: ReadonlyMap<string, string>, entryIds?: ReadonlyArray<string>) {
		return EntryRelation.repoint(em, uids, this.inCalendars(), entryIds)
	}

	/** Keeps a query of entries to the user's calendars `sources` names, joined through their integration rather than listed by id. */
	private inCalendars(sources: FilterQuery<Source> = {}) {
		return { sourceId: { ...sources as object, integrationId: { userId: this.id } } } as unknown as FilterQuery<Entry>
	}

	/**
	 * The user's relations whole, over the entries at both ends of each, and the entries `reaching` points at besides: the
	 * graph a read serves and a candidate list is judged on. The rows of the user's own entries only: another user's link
	 * to a uid they share is not the user's to see.
	 */
	async getRelationGraph(em: EntityManager, reaching = EntryRelations.none) {
		const rows = await em.find(EntryRelation, { entryId: this.inCalendars() } as FilterQuery<EntryRelation>)
		const ownerIds = [...new Set(rows.map(row => row.entryId))]
		const targetUids = [...new Set([...rows.map(row => row.targetUid), ...reaching.all.map(relation => relation.targetUid)])]
		if (!ownerIds.length && !targetUids.length) {
			return RelationGraph.empty
		}
		const [owners, targets] = await Promise.all([
			ownerIds.length ? em.find(Entry, { $and: [{ id: { $in: ownerIds }, recurrenceId: null }, this.inCalendars()] }) : [],
			targetUids.length ? em.find(Entry, { $and: [{ uid: { $in: targetUids }, recurrenceId: null }, this.inCalendars()] }) : [],
		])
		const rowsByEntry = Map.groupBy(rows, row => row.entryId)
		return RelationGraph.of(new Set([...owners, ...targets]), entry => EntryRelations.of((rowsByEntry.get(entry.id!) ?? []).map(row => row.relation)))
	}
}
