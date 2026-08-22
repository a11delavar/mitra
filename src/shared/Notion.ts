import { type EntityManager } from '@mikro-orm/sqlite'
import { converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { model } from './model.js'
import { Integration, integration, withheld } from './Integration.js'
import { Source } from './Source.js'
import { Entry, TaskStatus, FLOATING_TIME_ZONE } from './Entry.js'
import { EntryType } from './EntryType.js'
import { calendarDateOf, midnightOf } from './calendarDate.js'
import { Color } from './Color.js'
import { Relation } from './Relation.js'
import { RelationType } from './RelationType.js'
import { EntryRelation } from './EntryRelation.js'
import { createLogger } from './Logger.js'
import { NotionClient, NotionRequestError, type NotionBlock, type NotionDataSource, type NotionDate, type NotionPage, type NotionPropertyCondition, type NotionPropertyValue, type NotionRichText, type NotionView, type NotionViewFilter } from './NotionClient.js'
import { NotionMarkdown } from './NotionMarkdown.js'

const logger = createLogger('Notion')

export interface NotionCredentials {
	/** The workspace's display label (what the sidebar titles the integration with) — captured from
	 * the token's bot user at discovery, never typed by the user. */
	username: string
	/** The connection's secret: an internal-connection token or a personal access token, pasted from
	 * Notion's developer portal. A static bearer secret, like a CalDAV password — no OAuth dance. */
	token: string
}

/**
 * What a Notion source's pages mean as tasks — the mapping surface between a data source's schema
 * and mitra's Entry, resolved once per data source (see {@link Notion.schemaIndexOf}) and consumed
 * by every page read/write. Properties are addressed by NAME (that's how page property maps are
 * keyed); the status option→group resolution is precomputed because a page's status value carries
 * only the option, never its group.
 */
export interface NotionSchemaIndex {
	titleProperty: string
	statusProperty: string
	dateProperty: string
	/** Status option id → the task status of the group it belongs to. */
	statusByOption: ReadonlyMap<string, TaskStatus>
	/** Task status → the option id to write (each group's first option). A status without any
	 * option in its group is unwritable and absent here. */
	optionByStatus: ReadonlyMap<TaskStatus, string>
	/** The relation properties that carry entry↔entry links, one per RELTYPE mitra stores — see
	 * {@link Notion.relationPropertiesOf}. Empty when the database has none. */
	relationProperties: ReadonlyArray<NotionRelationProperty>
}

/**
 * One self-referencing relation property and the RELTYPE its ids mean. The mapping is a BIJECTION
 * by construction (one property per type): the read needs property → type, and the write needs
 * type → property, since Notion stores a relation property wholesale.
 */
export interface NotionRelationProperty {
	/** How a page's property map is keyed — by NAME, like every other mapped property. */
	name: string
	/** The percent-encoded schema id, which is what {@link NotionClient.pageRelation} addresses. */
	id: string
	type: RelationType
}

/**
 * Notion integration: DATABASE VIEWS as task sources. Notion is not a calendar — its unit of
 * scheduling is a page in a database — so this integration models exactly what Notion can express:
 *
 * - Every view of every shared task database (one with a status AND a date property) becomes a
 *   selectable source holding {@link EntryType.Task} alone. Views are the right grain because Notion evaluates
 *   their filters server-side ("My tasks", "This sprint") — mitra never re-implements filter
 *   semantics, it just asks the view for its members.
 * - Pages map to task entries: title ↔ heading, status option ↔ task status via the schema's
 *   option groups, the date property ↔ start/end (date-only values are all-day, zoned date-times
 *   keep their IANA zone), and the page BODY ↔ the markdown description ({@link NotionMarkdown}):
 *   the block types markdown can express round-trip faithfully, while collaborative content it
 *   can't (images, embeds, sub-pages, deep nesting) stays invisible AND untouched — a description
 *   edit only ever replaces the blocks the description showed (see {@link replaceBody}).
 * - NOT expressible in Notion, deliberately absent rather than approximated: recurrence (the API
 *   has no repeat concept — writes carrying a rule are rejected so a series is never silently
 *   collapsed), the cancelled status (Notion's groups are to-do/in-progress/complete), reminders,
 *   and location. See {@link capabilities}, which the editor uses to hide those fields for
 *   entries living here.
 * - Relationships map onto the database's own SELF-REFERENCING relation properties, resolved by
 *   name like the status/date ones ({@link relationPropertiesOf}) — "Parent Task" is a `PARENT`
 *   line, "Blocked by" a `FINISHTOSTART` one — which makes Notion authoritative for them the way
 *   `RELATED-TO` makes CalDAV. The entry's `uid` IS the page id ({@link applyPage}), so a relation
 *   value needs no translation. Notion is authoritative only where its schema can actually hold the
 *   fact: a link whose target is not a page of this data source (a CalDAV event, say) has no Notion
 *   word, so it stays mitra-owned in the relation table and the parse carries it along untouched
 *   — the same "replace only what it shows" discipline the page body follows.
 *
 * Auth is a pasted token (internal connection or PAT): unlike Google's OAuth — which only works
 * once a deployment operator registers a client and configures env vars — a token connects on any
 * self-hosted instance with zero deployment configuration, which suits mitra's single-user default.
 * The `(userId, uri)` identity is the token's bot user id, so re-pasting a token for the same
 * connection updates in place instead of duplicating.
 */
@model('Notion')
@integration('notion')
export class Notion extends Integration<NotionCredentials> {
	static readonly label: string = 'Notion'
	static readonly logo: string = 'notion'
	static readonly description: string = 'The task databases of your workspace'

	static readonly uriPrefix = 'notion://'

	/** View types that hold plain task rows. Forms collect input, charts/maps/dashboards render
	 * aggregates — none of them is a list of tasks to mirror. */
	private static readonly sourceViewTypes = new Set(['table', 'board', 'list', 'calendar', 'timeline', 'gallery'])

	/** A source's identity: the data source (the queryable row container) plus the view within it.
	 * Both are Notion uuids — stable under renames, unlike titles. */
	static sourceUri(dataSourceId: string, viewId: string): string {
		return `${Notion.uriPrefix}${dataSourceId}/${viewId}`
	}

	static idsOf(source: { uri: string }): { dataSourceId: string, viewId: string } {
		const [dataSourceId, viewId] = source.uri.startsWith(Notion.uriPrefix)
			? source.uri.slice(Notion.uriPrefix.length).split('/')
			: []
		if (!dataSourceId || !viewId) {
			throw new Error(`Not a Notion source uri: ${source.uri}`)
		}
		return { dataSourceId, viewId }
	}

	/** The integration token authorizes the workspace; the label identifies it. */
	@converter(withheld<NotionCredentials>('token')) override credentials!: NotionCredentials

	constructor(init?: Partial<Notion>) {
		super()
		// This provider's own blank credential shape — see CalDAV's constructor for the why (bind/undefined).
		this.credentials = { username: '', token: '' }
		Object.assign(this, init)
	}

	// A fixed label (like GoogleCalendar's): the STI discriminator isn't populated on fresh instances.
	override toString() {
		return `Notion integration for "${this.credentials.username || this.uri || '(new)'}"`
	}

	/** Nothing Notion models can hold these — the editor hides the fields (and the write mapping
	 * rejects recurrence/cancelled) instead of silently dropping edits. `description: true`: the
	 * page body maps to markdown (see {@link NotionMarkdown}). `timeZone: false` because
	 * Notion's date property can't store a named IANA zone: its API resolves any `time_zone` to a
	 * fixed offset and returns `time_zone: null`, so a per-entry authoring zone would silently vanish
	 * on save (the times still show correctly in the viewer's zone — that's a view concern).
	 * `relations: true`: a self-referencing relation property IS a native link store, and it keeps what
	 * mitra writes (only for targets in the same database — see {@link retainedRelations}).
	 * `participants: false`: a page has no invitees — Notion's people property is workspace
	 * membership, not RFC 5545 group-scheduling, and mapping one onto the other would fake RSVP
	 * semantics the provider doesn't have. `transparency`/`visibility`: a Notion page contributes to
	 * no free/busy answer and has no per-page access class — sharing is a workspace/page permission,
	 * which is a different thing wearing a similar word. */
	override get capabilities() {
		return { recurrence: false, reminders: false, location: false, description: true, cancelledStatus: false, timeZone: false, participants: false, transparency: false, visibility: false, relations: true }
	}

	// The workspace identity derives from the token (its bot user), so the token is all a connect needs.
	override get canConnect() {
		return !!this.credentials.token
	}

	/** Notion allows ~3 requests/second per connection and a sync touches several endpoints —
	 * one poll a minute keeps a few connected workspaces comfortably inside that, like Google. */
	override get syncInterval() { return 60_000 }

	override merge(incoming: this) {
		this.credentials = {
			// The label comes from the token's bot user (fetchSources), never from the form.
			username: this.credentials.username ?? '',
			// A blank incoming token keeps the stored secret — the edit form leaves it empty.
			token: incoming.credentials?.token || this.credentials.token,
		}
	}

	/** Transient, like {@link CalDAV.client}: `out: {}` keeps a live connection out of the wire. */
	@converter({ out: {} }) private client?: NotionClient

	/** A seam for tests: subclasses stub the client instead of the network. */
	protected createClient(): NotionClient {
		return new NotionClient(this.credentials.token)
	}

	protected getClient(): NotionClient {
		return this.client ??= this.createClient()
	}

	/** Data source schemas, memoized for the life of this instance — one instance serves one sync
	 * cycle (or one request), so sibling views of a database share a single schema fetch and the
	 * cache can never go stale across cycles. */
	@converter({ out: {} }) private dataSources?: Map<string, Promise<NotionDataSource>>

	private dataSource(dataSourceId: string): Promise<NotionDataSource> {
		this.dataSources ??= new Map()
		let dataSource = this.dataSources.get(dataSourceId)
		if (!dataSource) {
			dataSource = this.getClient().dataSource(dataSourceId)
			this.dataSources.set(dataSourceId, dataSource)
		}
		return dataSource
	}

	private async schemaFor(source: Source): Promise<NotionSchemaIndex> {
		const { dataSourceId } = Notion.idsOf(source)
		const schema = Notion.schemaIndexOf(await this.dataSource(dataSourceId))
		if (!schema) {
			throw new Error(`The Notion database behind "${source.name}" no longer has the status and date properties mitra maps tasks onto`)
		}
		return schema
	}

	// --- Discovery --------------------------------------------------------------------------------

	protected override async fetchSources(): Promise<Array<Source>> {
		const client = this.getClient()

		// The token's bot user is the connection's identity and label. Resolved here — the earliest
		// authenticated call — so a fresh add acquires its `(userId, uri)` identity before first flush.
		const me = await client.me()
		this.uri = `${Notion.uriPrefix}${me.id}`
		this.credentials = { ...this.credentials, username: me.bot?.workspace_name || me.name || 'Notion' }

		const dataSources = await client.searchDataSources()
		// Throwing beats returning []: the base reconciliation reads an empty list as "every source
		// vanished" and cascades their entries away — the wrong outcome for a transient Notion search
		// blip, and even the legitimate unshare-everything case is better served by a loud message
		// (delete the integration to disconnect). On a first connect this doubles as setup guidance.
		if (!dataSources.length) {
			throw new Error('No databases are shared with this Notion connection — open a database in Notion and add the connection under ••• → Connections')
		}
		const sources: Array<Source> = []
		for (const found of dataSources) {
			// Search results carry the schema; a defensive refetch covers slimmer responses.
			const dataSource = found.properties ? found : await this.dataSource(found.id)
			if (!Notion.schemaIndexOf(dataSource)) {
				logger.debug(`Skipping "${Notion.plainText(dataSource.title) || found.id}" — no status/date properties, not a task database`)
				continue
			}
			const title = Notion.plainText(dataSource.title) || 'Untitled'
			for (const view of await client.views(found.id)) {
				if (!Notion.isSourceView(view)) {
					continue
				}
				const uri = Notion.sourceUri(found.id, view.id)
				sources.push(new Source({
					uri,
					// A Notion page is a task and nothing else — the one-type case of {@link Source.entryTypes}.
					entryTypes: [EntryType.Task],
					name: view.name ? `${title} · ${view.name}` : title,
					color: Color.get(uri).value,
					enabled: false,
				}))
			}
		}
		if (!sources.length) {
			throw new Error('None of the shared Notion databases has the status and date properties mitra maps tasks onto')
		}
		logger.debug(`Discovered ${sources.length} view(s) across ${dataSources.length} shared data source(s)`)
		return sources
	}

	static isSourceView(view: NotionView): boolean {
		return !view.type || Notion.sourceViewTypes.has(view.type)
	}

	// --- Sync -------------------------------------------------------------------------------------

	/** How far behind the stored watermark an incremental query reaches: Notion's last_edited_time
	 * is minute-rounded, so a same-minute edit after a sync would otherwise be missed forever. */
	private static readonly watermarkOverlapMs = 2 * 60_000

	/**
	 * Full-membership, incremental-content sync. The view's member ids are fetched COMPLETELY each
	 * cycle — that's what makes deletions (and pages drifting out of a filtered view, e.g. a
	 * time-relative "this week" filter) a simple set difference, with Notion owning the filter
	 * semantics. Page CONTENT is fetched incrementally: one data-source query for pages edited
	 * since the watermark; a member that is neither locally known nor recently edited (it slid
	 * into the view without an edit) is fetched individually — the rare case by construction.
	 */
	protected override async syncSourceEntries(em: EntityManager, source: Source): Promise<boolean> {
		const client = this.getClient()
		const { dataSourceId, viewId } = Notion.idsOf(source)
		const schema = await this.schemaFor(source)

		const membership = await client.viewPageIds(viewId)
		const memberIds = new Set(membership.ids)
		const watermark = source.syncState?.lastEditedAfter as string | undefined
		const editedSince = watermark ? new Date(Date.parse(watermark) - Notion.watermarkOverlapMs).toISOString() : undefined
		const editedPages = new Map((await client.queryDataSourcePages(dataSourceId, editedSince)).map(page => [page.id, page]))

		const existing = await em.find(Entry, { sourceId: source.id })
		const existingByUri = new Map(existing.map(entry => [entry.uri, entry]))

		// Relationships: the stored rows up front (the parse below must know which of them Notion
		// cannot hold), and the page ids this data source is authoritative for.
		await EntryRelation.loadFor(em, existing)
		const pageIds = await this.dataSourcePageIds(em, dataSourceId, memberIds)
		const isPage = (uid: string) => pageIds.has(uid)
		const applied: Array<Entry> = []

		let changed = false

		// 1. Deletions: the source mirrors the view, so a row absent from the membership is gone —
		// trashed, or no longer matching the view's filter. Two guards, neither of which retains
		// non-Notion content, both of which only avoid destroying a row on unreliable/eventually-
		// consistent data:
		// - a membership truncated at the query cache's 10k cap isn't the full set, so it drives no
		//   deletions at all this cycle; and
		// - a row mitra wrote moments ago is spared for one overlap window while Notion's view index
		//   catches up — otherwise a legitimate new member would be deleted then re-added (a flicker).
		//   The clock is deliberately OUR OWN (`localWriteAt`, stamped by create/update) so that
		//   ordinary server↔Notion clock skew can't defeat the window; it applies uniformly to every
		//   recently-written row, created or edited.
		const now = Date.now()
		if (membership.complete) {
			for (const entry of existing) {
				const recentlyWritten = entry.data?.localWriteAt && now - entry.data.localWriteAt < Notion.watermarkOverlapMs
				if (!recentlyWritten && (!entry.uri || !memberIds.has(entry.uri))) {
					em.remove(entry)
					changed = true
				}
			}
		} else {
			logger.warn(`View membership of "${source.name}" is truncated (10k cap) — skipping remote-deletion detection this cycle`)
		}

		// 2. Upserts for the current members. `changed` is decided by comparing the mapped fields, not
		// the edit stamp: last_edited_time is minute-rounded, so an unchanged stamp can hide a real
		// remote edit (apply anyway when the delta re-serves it) and mitra's own write-echoes re-served
		// inside the overlap window must not tick clients (apply, compare equal, stay silent).
		for (const id of memberIds) {
			const entry = existingByUri.get(id)
			let page = editedPages.get(id)
			if (!page) {
				if (entry) {
					continue // known and unedited since the watermark — nothing to do
				}
				// Entered the view without an edit — fetch it on its own. Tolerate the list-then-fetch
				// race the way deleteEntry does: a page deleted or access-revoked between the membership
				// snapshot and now (404/403) is skipped, not fatal — the next cycle reconciles it —
				// rather than aborting the whole source's sync (and stalling its watermark).
				try {
					page = await client.page(id)
				} catch (error) {
					if (error instanceof NotionRequestError && (error.status === 404 || error.status === 403)) {
						logger.debug(`Skipping view member ${id}: ${error.message}`)
						continue
					}
					throw error
				}
			}
			if (page.in_trash) {
				continue // trashed between the membership listing and this read — next cycle's set difference removes it
			}
			// The page body IS the description (see NotionMarkdown) — fetched per applied page. Always
			// when the delta serves it: a body edit within the stamp's minute-rounding would otherwise
			// be skippable forever, the same reasoning as applying properties above. Gone-page races
			// keep the stored description, like the individual fetch above.
			let description = entry?.description ?? ''
			try {
				description = NotionMarkdown.toMarkdown(await this.fetchBodyBlocks(page.id))
			} catch (error) {
				if (!(error instanceof NotionRequestError) || (error.status !== 404 && error.status !== 403)) {
					throw error
				}
				logger.debug(`Keeping the stored description of ${page.id}: ${error.message}`)
			}
			const before = entry?.clone()
			const target = entry ?? new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: page.id })
			if (!entry) {
				em.persist(target)
			}
			Notion.applyPage(target, page, schema, { description, ...await this.relationsOf(page, schema, target.relations, isPage) })
			applied.push(target)
			// Relationships are deliberately outside `editEquals` (they have their own write path), so
			// a remote relation edit is compared here or it would never reach a client. An abstaining
			// parse (`undefined`) changed nothing and must not tick.
			if (!before || !before.editEquals(target) || (target.relations !== undefined && !Relation.listEquals(before.relations, target.relations))) {
				changed = true
			}
		}

		// Mirror the parsed relationships into the queryable store. Only the pages applied this cycle:
		// an entry left untouched still carries the rows loadFor read, and a removed one's cascade.
		await this.reconcileRelations(em, applied)

		// The watermark advances to the newest edit actually seen — never to "now", whose clock is
		// ours, not Notion's. Bookkeeping only: it must not count as a change (see Integration).
		const newest = [...editedPages.values()].map(page => page.last_edited_time).sort().at(-1)
		if (newest && (!watermark || newest > watermark)) {
			source.syncState = { ...source.syncState, lastEditedAfter: newest }
		}

		logger.debug(`Synced "${source.name}": ${memberIds.size} member(s), ${editedPages.size} edited${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	/**
	 * The page ids of this data source mitra knows: the view's current members plus every row of
	 * every source mirroring the same data source. This is the ownership test behind a relationship —
	 * a target among them is one a relation property CAN hold, so Notion is authoritative for that
	 * edge; anything else is mitra's alone ({@link retainedRelations}).
	 *
	 * A page of this database that no enabled view mirrors reads as mitra-owned, so a line pointing
	 * at it lingers locally until that page syncs. That is the conservative direction on purpose: a
	 * stale local pointer, never a relationship silently dropped.
	 */
	private async dataSourcePageIds(em: EntityManager, dataSourceId: string, memberIds: Iterable<string> = []): Promise<Set<string>> {
		const sourceIds = (await em.find(Source, { integrationId: this.id }))
			.filter(source => source.uri.startsWith(`${Notion.uriPrefix}${dataSourceId}/`))
			.map(source => source.id)
		const entries = sourceIds.length ? await em.find(Entry, { sourceId: { $in: sourceIds } }) : []
		return new Set([...memberIds, ...entries.flatMap(entry => entry.uri ? [entry.uri] : [])])
	}

	/**
	 * The DEFINITE relationships a page decodes to, as an {@link applyPage} option bag — Notion's own
	 * lines plus the stored ones it cannot hold. Notion truncates a relation value at 25 ids, so a
	 * flagged one is COMPLETED first (on the page object itself, which is also what a wholesale
	 * property write would be derived from).
	 *
	 * When that completion is refused (the page went private or vanished mid-cycle) the answer is
	 * `{ relations: undefined }` — the tri-state's "no authority here", leaving the stored rows
	 * exactly as they are. Claiming the truncated list instead would delete the ids mitra never saw,
	 * from the table now and from Notion on the next write.
	 */
	private async relationsOf(page: NotionPage, schema: NotionSchemaIndex, stored: ReadonlyArray<Relation> | null | undefined, isPage: (uid: string) => boolean): Promise<{ relations: Array<Relation> | null | undefined }> {
		for (const property of schema.relationProperties) {
			const value = page.properties[property.name]
			if (value?.has_more) {
				try {
					value.relation = await this.getClient().pageRelation(page.id, property.id)
					value.has_more = false
				} catch (error) {
					if (error instanceof NotionRequestError && (error.status === 404 || error.status === 403)) {
						logger.debug(`Leaving the relationships of ${page.id} untouched — "${property.name}" is truncated and unreadable: ${error.message}`)
						return { relations: undefined }
					}
					throw error
				}
			}
		}
		return { relations: Notion.relationsFrom(page, schema, Notion.retainedRelations(stored, schema, isPage)) }
	}

	// --- Entry CRUD ---------------------------------------------------------------------------------

	override async createEntry(em: EntityManager, entry: Entry): Promise<Entry> {
		if (entry.recurrence) {
			throw new Error('Notion does not support recurring tasks')
		}
		const source = await em.findOneOrFail(Source, { id: entry.sourceId })
		const { dataSourceId, viewId } = Notion.idsOf(source)
		const schema = await this.schemaFor(source)
		const dataSource = await this.dataSource(dataSourceId) // memoized — schemaFor already fetched it

		// A page is created in the DATA SOURCE, not the view; a filtered view shows it only if it
		// matches the filter. So pre-fill the view's filter properties (e.g. Area = "University") —
		// exactly what Notion's own UI does when you add a row from inside a filtered view. Our own
		// mapped fields (title/status/date) always win over a filter default, so the user's chosen
		// status is never overridden just to satisfy the view. The view fetch is best-effort: a hiccup
		// (or a view deleted out from under us) degrades to creating without the pre-fill rather than
		// failing the create outright.
		const filterDefaults = await this.getClient().view(viewId).then(view => Notion.deriveFilterDefaults(view, dataSource)).catch(error => {
			logger.warn(`Could not read the filter of view ${viewId} to pre-fill a new task — creating without it: ${error instanceof Error ? error.message : error}`)
			return {} as Record<string, NotionPropertyValue>
		})
		// Relationships ride the create: a draft authors them, and `changedRelationProperties` against
		// "nothing yet" yields exactly the properties with targets — so an empty one never overrides a
		// filter default (a view may well filter on the very relation property being mapped).
		const pageIds = schema.relationProperties.length ? await this.dataSourcePageIds(em, dataSourceId) : new Set<string>()
		const isPage = (uid: string) => pageIds.has(uid)
		const properties = { ...filterDefaults, ...Notion.propertiesFrom(entry, schema), ...Notion.changedRelationProperties(null, entry.relations, schema, isPage) }
		const blocks = entry.description ? NotionMarkdown.toBlocks(entry.description) : []
		const page = await this.getClient().createPage(dataSourceId, properties, blocks.slice(0, Notion.maxBlocksPerWrite))
		for (let index = Notion.maxBlocksPerWrite; index < blocks.length; index += Notion.maxBlocksPerWrite) {
			await this.getClient().appendBlockChildren(page.id, blocks.slice(index, index + Notion.maxBlocksPerWrite))
		}
		// The stored description is the markdown as the block mapping will read it back — so the next
		// sync's body fetch compares equal and stays silent.
		const previousUid = entry.uid
		Notion.applyPage(entry, page, schema, { description: NotionMarkdown.toMarkdown(blocks), localWrite: true, ...await this.relationsOf(page, schema, entry.relations, isPage) })
		em.persist(entry)
		await Notion.repointRelations(em, previousUid, entry.uid!)
		return entry
	}

	/** Notion assigns the id that becomes this entry's uid ({@link applyPage}), so an entry MOVED into
	 * a Notion source cannot keep the uid it arrived with — the one case where "a migration carries
	 * the uid" cannot hold. Re-point what pointed AT the old one, so a move orphans no relationship.
	 * A plain create is a no-op: nothing can already point at a uid minted moments ago. */
	private static async repointRelations(em: EntityManager, previousUid: string | undefined, uid: string): Promise<void> {
		if (!previousUid || previousUid === uid) {
			return
		}
		for (const row of await em.find(EntryRelation, { targetUid: previousUid })) {
			row.targetUid = uid
		}
	}

	override async updateEntry(em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		if (incoming.recurrence) {
			throw new Error('Notion does not support recurring tasks')
		}
		if (!existing.uri) {
			throw new Error('Entry has no Notion page id')
		}
		// Diff-scoped write: only properties the edit actually changed go over the wire, so an
		// untouched field can never clobber a fresher remote value (Notion has no etag guard).
		const headingChanged = existing.heading !== incoming.heading
		const statusChanged = existing.status !== incoming.status
		const descriptionChanged = (existing.description ?? '') !== (incoming.description ?? '')
		const spanChanged = (['start', 'end', 'allDay', 'timeZone'] as const).some(key => !Object[equals](existing[key], incoming[key]))
		// Relations are tri-state like CalDAV's (undefined = keep) and compare by their own value
		// semantics; the caller populated `existing.relations` from the store (see entries.ts PUT).
		const relationsChanged = incoming.relations !== undefined && !Relation.listEquals(existing.relations ?? null, incoming.relations)
		if (!headingChanged && !statusChanged && !spanChanged && !descriptionChanged && !relationsChanged) {
			return
		}
		const source = await em.findOneOrFail(Source, { id: existing.sourceId })
		const schema = await this.schemaFor(source)
		const desiredRelations = relationsChanged ? incoming.relations ?? null : existing.relations
		const pageIds = schema.relationProperties.length
			? await this.dataSourcePageIds(em, Notion.idsOf(source).dataSourceId)
			: new Set<string>()
		const isPage = (uid: string) => pageIds.has(uid)
		// Body first, page echo after: block writes bump last_edited_time, and the echo below must
		// carry the newest stamp so the next delta's re-serve compares clean.
		const description = descriptionChanged ? await this.replaceBody(existing.uri, incoming.description ?? '') : existing.description
		const properties = {
			...Notion.propertiesFrom(incoming, schema, {
				heading: headingChanged,
				status: statusChanged,
				span: spanChanged,
			}),
			...(relationsChanged ? Notion.changedRelationProperties(existing.relations, incoming.relations, schema, isPage) : {}),
		}
		if (!Object.keys(properties).length && !descriptionChanged) {
			// Nothing Notion can hold actually changed — an edit to a mitra-owned relationship alone, say.
			// The relation table (which the route reconciles) is where that edit lives; there is no page
			// write to make and therefore no echo to read back.
			return
		}
		const page = Object.keys(properties).length
			? await this.getClient().updatePage(existing.uri, properties)
			: await this.getClient().page(existing.uri) // a description-only edit — no property to write, just the fresh stamp
		Notion.applyPage(existing, page, schema, { description, localWrite: true, ...await this.relationsOf(page, schema, desiredRelations, isPage) })
		await this.syncSiblingRows(em, existing, page, schema, description, isPage)
	}

	/**
	 * Mirror a page write onto the OTHER rows carrying the same page — one exists per enabled view
	 * containing it (overlapping views are a deliberate choice, see the add dialog). Without this, an
	 * edit through one view leaves its twin stale for up to a sync interval — the CalDAV counterpart
	 * is syncResourceRows. Scoped to this integration's sources, mirroring CalDAV's sibling scoping.
	 */
	private async syncSiblingRows(em: EntityManager, written: Entry, page: NotionPage, schema: NotionSchemaIndex, description: string | undefined, isPage: (uid: string) => boolean): Promise<void> {
		const siblings = await this.siblingRows(em, written)
		// Each twin's OWN stored rows: a link mitra owns (one Notion cannot hold) was authored on one
		// row, so the page echo must not be read as authority over the others' — see relationsOf.
		await EntryRelation.loadFor(em, siblings)
		for (const sibling of siblings) {
			Notion.applyPage(sibling, page, schema, { description, localWrite: true, ...await this.relationsOf(page, schema, sibling.relations, isPage) })
			await EntryRelation.reconcile(em, sibling.id!, sibling.relations ?? null)
		}
	}

	private async siblingRows(em: EntityManager, entry: Entry): Promise<Array<Entry>> {
		const sourceIds = (await em.find(Source, { integrationId: this.id })).map(source => source.id)
		return em.find(Entry, { uri: entry.uri, sourceId: { $in: sourceIds }, id: { $ne: entry.id } })
	}

	override async deleteEntry(em: EntityManager, entry: Entry): Promise<void> {
		if (entry.uri) {
			try {
				await this.getClient().trashPage(entry.uri)
			} catch (error) {
				// Already gone remotely — deleting it locally is the right outcome, not an error.
				if (!(error instanceof NotionRequestError) || error.status !== 404) {
					throw error
				}
			}
			// The page is in the trash now — every view's row of it goes, not just the edited one's.
			for (const sibling of await this.siblingRows(em, entry)) {
				em.remove(sibling)
			}
		}
		em.remove(entry)
	}

	/** Unreachable by construction: no Notion entry ever carries a recurrence rule. */
	override excludeOccurrence(): Promise<void> {
		return Promise.reject(new Error('Notion does not support recurring tasks'))
	}

	// --- Page body ↔ description ----------------------------------------------------------------------

	/** Notion caps one children write at 100 blocks — longer bodies append in chunks. */
	private static readonly maxBlocksPerWrite = 100

	/**
	 * The page body as a tree: one listing per container level, descending only into the types whose
	 * children carry convertible content and exactly as deep as a write payload may nest — so
	 * whatever this read renders, {@link replaceBody} can faithfully re-author. A deeper (or
	 * unsupported) branch stays unfetched, which marks its parent opaque (preserved, invisible)
	 * via {@link NotionMarkdown.isReplaceable}.
	 */
	private async fetchBodyBlocks(blockId: string, depth = 0): Promise<Array<NotionBlock>> {
		const blocks = await this.getClient().blockChildren(blockId)
		for (const block of blocks) {
			if (block.id && block.has_children && depth < NotionMarkdown.maxNestingDepth && NotionMarkdown.containerTypes.has(block.type)) {
				const content = NotionMarkdown.contentOf(block)
				if (content) {
					content.children = await this.fetchBodyBlocks(block.id, depth + 1)
				}
			}
		}
		return blocks
	}

	/**
	 * Re-authors the page body from `markdown` and returns the description the page now holds (the
	 * markdown normalized through the block mapping, which is what the next sync's read yields).
	 * Deliberately NOT a wholesale rewrite: only the blocks the description actually showed
	 * ({@link NotionMarkdown.isReplaceable}) are deleted — an image, embed, sub-page or
	 * deeper-than-readable branch was invisible in the editor and survives untouched, with the new
	 * content appended after it. Block deletes are trash moves, recoverable in Notion — together
	 * that's what makes a collaborative page body safe to edit from a plain markdown field.
	 */
	private async replaceBody(pageId: string, markdown: string): Promise<string> {
		const client = this.getClient()
		const blocks = NotionMarkdown.toBlocks(markdown)
		for (const block of await this.fetchBodyBlocks(pageId)) {
			if (block.id && NotionMarkdown.isReplaceable(block)) {
				await client.deleteBlock(block.id)
			}
		}
		for (let index = 0; index < blocks.length; index += Notion.maxBlocksPerWrite) {
			await client.appendBlockChildren(pageId, blocks.slice(index, index + Notion.maxBlocksPerWrite))
		}
		return NotionMarkdown.toMarkdown(blocks)
	}

	// --- Mapping (pure, static — the tested surface) ------------------------------------------------

	static plainText(richText: Array<NotionRichText> | undefined): string {
		return (richText ?? []).map(run => run.plain_text ?? run.text?.content ?? '').join('')
	}

	/** Notion's fixed status groups → task statuses. Group names are canonical in the API; the
	 * positional fallback covers a group set that arrives unnamed. Cancelled has no group — that's
	 * exactly why the status is unsupported here. */
	private static taskStatusOfGroup(name: string | undefined, index: number, count: number): TaskStatus {
		switch (name?.toLowerCase()) {
			case 'to-do': return TaskStatus.ToDo
			case 'in progress': return TaskStatus.Doing
			case 'complete': return TaskStatus.Done
			default: return index === 0 ? TaskStatus.ToDo : index === count - 1 ? TaskStatus.Done : TaskStatus.Doing
		}
	}

	/**
	 * Resolve what makes this data source a task database — or undefined when it isn't one:
	 * mitra requires a status property (completion is what makes a page a task) and a date
	 * property (a calendar can't place an unschedulable task). With several candidates, a
	 * conventionally-named property wins over schema order, so "Due" beats a decorative
	 * "Created" date sitting earlier in the map.
	 */
	static schemaIndexOf(dataSource: NotionDataSource): NotionSchemaIndex | undefined {
		const properties = Object.values(dataSource.properties ?? {})
		const named = (type: string, preferred: ReadonlyArray<RegExp>) => {
			const candidates = properties.filter(property => property.type === type)
			for (const pattern of preferred) {
				const match = candidates.find(property => pattern.test(property.name))
				if (match) {
					return match
				}
			}
			return candidates[0]
		}

		const title = properties.find(property => property.type === 'title')
		const status = named('status', [/^status$/i])
		const date = named('date', [/^due\b/i, /^(date|when|deadline|scheduled|do date)$/i])
		if (!title || !status?.status || !date) {
			return undefined
		}

		const statusByOption = new Map<string, TaskStatus>()
		const optionByStatus = new Map<TaskStatus, string>()
		const groups = status.status.groups ?? []
		groups.forEach((group, index) => {
			const taskStatus = Notion.taskStatusOfGroup(group.name, index, groups.length)
			for (const optionId of group.option_ids) {
				statusByOption.set(optionId, taskStatus)
			}
			// Each group's FIRST option is the write target (Notion's own default per group);
			// first mapping wins should two groups resolve to the same status.
			if (!optionByStatus.has(taskStatus) && group.option_ids.length) {
				optionByStatus.set(taskStatus, group.option_ids[0]!)
			}
		})

		return { titleProperty: title.name, statusProperty: status.name, dateProperty: date.name, statusByOption, optionByStatus, relationProperties: Notion.relationPropertiesOf(dataSource) }
	}

	/**
	 * What each relation property NAME means, in the vocabulary of {@link RelationType}. The names
	 * are the ones Notion's own task templates and its built-in sub-item feature create (verified
	 * against a real workspace: "Parent Task"/"Sub Tasks", "Blocked by"/"Blocking"), matched whole so
	 * a mirror twin can never be mistaken for its canonical end.
	 *
	 * An `undefined` type marks a name that is RECOGNIZED but unstorable: all four RFC 9253 temporal
	 * types are authored on the DEPENDENT, so "Blocking" — the end naming what waits on THIS page —
	 * has no RELTYPE to be written as. That edge belongs to the other page, and where the "Blocked
	 * by" twin exists it already carries the same relationship in the direction mitra stores.
	 */
	private static readonly relationTypesByName: ReadonlyArray<readonly [RegExp, RelationType | undefined]> = [
		[/^parent[\s-]?(task|item|page|project)?s?$/i, RelationType.Parent],
		[/^sub[\s-]?(task|item|page)s?$|^child(ren)?$/i, RelationType.Child],
		[/^blocked[\s-]?by$|^depends?[\s-]?on$|^waiting[\s-]?on$|^predecessors?$/i, RelationType.FinishToStart],
		[/^block(s|ing)$|^successors?$|^dependents?$/i, undefined],
	]

	/** The RELTYPE a relation property's name means — a conventional one from
	 * {@link relationTypesByName}, else an opaque `X-NOTION-…` type built from the name itself. An
	 * unrecognized Notion relation is a link with no direction semantics: reading it as PARENT or
	 * FINISHTOSTART would borrow a word that means something else, and SIBLING is already taken (it
	 * means "shares a parent") — so the open vocabulary carries it as itself, round-tripping
	 * losslessly and rendering read-only under its own section. `undefined` = not mapped at all. */
	private static relationTypeOf(name: string): RelationType | undefined {
		for (const [pattern, type] of Notion.relationTypesByName) {
			if (pattern.test(name.trim())) {
				return type
			}
		}
		const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
		return slug ? RelationType.of(`X-NOTION-${slug}`) : undefined
	}

	/**
	 * The relation properties that relate one task to another, and what each one means. Three rules,
	 * each of them a claim about what Notion genuinely stores:
	 *
	 * - SELF-REFERENCING only. A relation into another database ("Area", "Project") relates a task to
	 *   something that is not an entry — not a relationship in mitra's sense, so it is left alone
	 *   (it is also how a filtered view pins its rows — see {@link deriveFilterDefaults}).
	 * - ONE END of a two-way relationship. Notion exposes a `dual_property` relation as two synced
	 *   properties; mitra stores one direction and derives the reverse, so only the end it stores is
	 *   mapped — "Parent Task" over its "Sub Tasks" twin, "Blocked by" over "Blocking". Where the
	 *   twins are equally uninterpreted the schema's own order breaks the tie. A lone inverse
	 *   ("Blocking" with no "Blocked by") maps to nothing: its edge points the way mitra cannot
	 *   store, and inventing a direction for it would be a lie about who waits for whom.
	 * - ONE property per type, so the write direction knows where a line goes: a second property
	 *   claiming a type already taken is skipped rather than silently merged into the first.
	 */
	static relationPropertiesOf(dataSource: NotionDataSource): Array<NotionRelationProperty> {
		const candidates = Object.values(dataSource.properties ?? {})
			.filter(property => property.type === 'relation' && (property.relation?.data_source_id === dataSource.id
				|| (!!property.relation?.database_id && property.relation.database_id === dataSource.parent?.database_id)))
			.map(property => ({ property, type: Notion.relationTypeOf(property.name) }))

		// Lower wins a twin pair: the end mitra stores, then a foreign direction it can still read,
		// then an uninterpreted link, then the end it cannot store at all.
		const rank = (type: RelationType | undefined) => type === undefined ? 3
			: type === RelationType.Parent || type === RelationType.FinishToStart ? 0
				: type === RelationType.Child ? 1 : 2

		const properties: Array<NotionRelationProperty> = []
		for (const [index, candidate] of candidates.entries()) {
			const twinName = candidate.property.relation?.dual_property?.synced_property_name
			const twin = twinName === undefined ? undefined : candidates.find(other => other.property.name === twinName)
			const twinWins = !!twin && (rank(twin.type) < rank(candidate.type)
				|| (rank(twin.type) === rank(candidate.type) && candidates.indexOf(twin) < index))
			if (candidate.type && !twinWins && !properties.some(mapped => mapped.type === candidate.type)) {
				properties.push({ name: candidate.property.name, id: candidate.property.id, type: candidate.type })
			}
		}
		return properties
	}

	// --- Relationships ------------------------------------------------------------------------------

	/**
	 * The page's outgoing relationships: one line per id in each mapped relation property, plus
	 * `retained` — the stored lines Notion cannot hold (see {@link retainedRelations}), which the
	 * caller passes so this stays the ONE definite value a read path assigns. Notion has no lead/lag
	 * concept, so `gap` is never set. A page relating to ITSELF is dropped: mitra reads a
	 * self-reference as meaningless ({@link Entry.relateTo} does too), not as an edge to draw.
	 *
	 * The page's values must be COMPLETE before this reads them — Notion truncates a relation at 25
	 * ids (see {@link NotionClient.pageRelation} and the caller that fills them in).
	 */
	static relationsFrom(page: NotionPage, schema: NotionSchemaIndex, retained: ReadonlyArray<Relation> = []): Array<Relation> | null {
		return Relation.normalize([
			...schema.relationProperties.flatMap(property => (page.properties[property.name]?.relation ?? [])
				.filter(reference => reference.id !== page.id)
				.map(reference => ({ type: property.type, targetUid: reference.id }))),
			...retained,
		])
	}

	/**
	 * The stored relationships Notion's schema genuinely cannot express — a type no mapped property
	 * carries, or a target that is not a page of this data source (a link to a CalDAV event, or to a
	 * task in a different Notion database). Per the per-fact authority rule those stay MITRA-owned:
	 * the relation table is their only home, so a parse claiming Notion as their authority would wipe
	 * them on the next sync, and a write smuggling them into a relation property would be rejected by
	 * Notion anyway.
	 */
	static retainedRelations(stored: ReadonlyArray<Relation> | null | undefined, schema: NotionSchemaIndex, isPage: (uid: string) => boolean): Array<Relation> {
		return (stored ?? []).filter(relation => !isPage(relation.targetUid)
			|| !schema.relationProperties.some(property => property.type === RelationType.of(relation.type)))
	}

	/** Every mapped relation property as the COMPLETE list of targets carrying its type — Notion
	 * writes a relation property wholesale, so a partial list would delete the rest. A property with
	 * no targets is present as an empty list: that is how the last line of its kind is removed. */
	static relationPropertiesFrom(relations: ReadonlyArray<Relation> | null | undefined, schema: NotionSchemaIndex, isPage: (uid: string) => boolean): Record<string, NotionPropertyValue> {
		const properties: Record<string, NotionPropertyValue> = {}
		for (const property of schema.relationProperties) {
			properties[property.name] = {
				relation: (relations ?? [])
					.filter(relation => RelationType.of(relation.type) === property.type && isPage(relation.targetUid))
					.map(relation => ({ id: relation.targetUid })),
			}
		}
		return properties
	}

	/** The relation properties an edit actually changed — {@link propertiesFrom}'s diff discipline,
	 * computed rather than flagged (one relation edit touches one property among several). A property
	 * whose list is unchanged is never rewritten, so a value mitra never saw stays intact. */
	static changedRelationProperties(existing: ReadonlyArray<Relation> | null | undefined, incoming: ReadonlyArray<Relation> | null | undefined, schema: NotionSchemaIndex, isPage: (uid: string) => boolean): Record<string, NotionPropertyValue> {
		const ids = (value: NotionPropertyValue | undefined) => (value?.relation ?? []).map(reference => reference.id).join(' ')
		const before = Notion.relationPropertiesFrom(existing, schema, isPage)
		const after = Notion.relationPropertiesFrom(incoming, schema, isPage)
		return Object.fromEntries(Object.entries(after).filter(([name, value]) => ids(value) !== ids(before[name])))
	}

	/**
	 * Property writes that make a new page satisfy a view's filter, so it appears in the view it was
	 * created in — mitra's counterpart to Notion pre-filling a filtered view's row. Reads BOTH the
	 * saved `filter` tree AND `quick_filters` (real task views keep their filtering in the latter;
	 * the top-level `filter` is frequently null). Only conditions a single written value can satisfy
	 * are honoured:
	 *   - `select equals` / `multi_select contains` → set that option (selects auto-create an unknown
	 *     option on write, so no schema check is needed);
	 *   - `status equals` → set it, but ONLY when it's a real option name (status options can't be
	 *     created on a page write, and the value may be a GROUP name, which isn't one);
	 *   - `checkbox equals` → set the boolean;
	 *   - `relation contains <page-id>` → point the relation at that page (this is the "Area = X"
	 *     shape real views use), when the relation property still resolves in the schema.
	 * Everything else is skipped: an OR branch (which one would we satisfy?), and any operator no
	 * single value pins down (`does_not_equal`, ranges, `is_empty`, formulas, or a relation whose
	 * property doesn't resolve — e.g. its related database isn't shared with the connection). A skipped
	 * condition just means the created page may not land in the view — the honest outcome (as in Notion
	 * itself), not a wrong guess; the source mirrors the view, with no local retention to paper over it.
	 * Property references vary in encoding — a saved filter tends to url-encode ids (`%60jqp`) while
	 * quick_filters use the raw id (`` `jqp ``) — so resolution tries the id verbatim, url-decoded,
	 * and the name.
	 */
	static deriveFilterDefaults(view: Pick<NotionView, 'filter' | 'quick_filters'> | undefined, dataSource: NotionDataSource): Record<string, NotionPropertyValue> {
		const properties: Record<string, NotionPropertyValue> = {}
		const schemaProperties = Object.values(dataSource.properties ?? {})
		const decode = (value: string) => { try { return decodeURIComponent(value) } catch { return value } }
		const resolve = (reference: string) => schemaProperties.find(property =>
			property.id === reference || decode(property.id) === reference || property.name === reference)

		const apply = (property: NotionDataSource['properties'][string], condition: NotionPropertyCondition): void => {
			if (condition.select?.equals !== undefined) {
				properties[property.name] = { select: { name: condition.select.equals } }
			} else if (condition.status?.equals !== undefined && property.status?.options.some(option => option.name === condition.status!.equals)) {
				properties[property.name] = { status: { name: condition.status.equals } }
			} else if (condition.multi_select?.contains !== undefined) {
				properties[property.name] = { multi_select: [{ name: condition.multi_select.contains }] }
			} else if (condition.checkbox?.equals !== undefined) {
				properties[property.name] = { checkbox: condition.checkbox.equals }
			} else if (condition.relation?.contains !== undefined) {
				properties[property.name] = { relation: [{ id: condition.relation.contains }] }
			}
		}

		const walk = (node: NotionViewFilter | undefined): void => {
			if (!node) {
				return
			}
			if ('and' in node) {
				node.and.forEach(walk) // every conjunct must hold — satisfy each satisfiable one
			} else if ('or' in node) {
				return // any one disjunct suffices, but picking one for the user would be a guess
			} else {
				const property = resolve(node.property)
				if (property) {
					apply(property, node)
				}
			}
		}

		walk(view?.filter)
		for (const [reference, condition] of Object.entries(view?.quick_filters ?? {})) {
			const property = resolve(reference)
			if (property) {
				apply(property, condition)
			}
		}
		return properties
	}

	/** Whether an ISO 8601 date string carries a clock (a bare date is Notion's all-day form). */
	private static isDateTime(value: string): boolean {
		return value.includes('T')
	}

	/** Whether a date-time string pins its own instant (a `Z` or a ±hh:mm offset). Notion omits
	 * the offset exactly when the value is a wall clock in the property's `time_zone`. */
	private static hasOffset(value: string): boolean {
		return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
	}

	/** One boundary of a Notion date value as a stored instant (see {@link spanFrom} for the rules). */
	private static instantFrom(value: string, timeZone: string | null | undefined): Date {
		if (!Notion.isDateTime(value)) {
			// Date-only: the canonical all-day encoding — the date's UTC midnight, wherever the server runs.
			return midnightOf(Temporal.PlainDate.from(value), 'UTC')
		}
		if (timeZone && !Notion.hasOffset(value)) {
			// A wall clock in the property's zone: resolve it through Temporal.
			return new Date(Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone, { disambiguation: 'compatible' }).epochMilliseconds)
		}
		return new Date(value)
	}

	/**
	 * A Notion date property value as mitra's span: date-only values are all-day (canonical
	 * UTC-midnight bounds, `end` inclusive→exclusive), date-times are instants — a value with a
	 * `time_zone` is that zone's wall clock (no offset) and the zone becomes the entry's
	 * authoring zone; otherwise the embedded offset is authoritative.
	 */
	static spanFrom(date: NotionDate | null | undefined): Pick<Entry, 'start' | 'end' | 'allDay' | 'timeZone'> {
		if (!date?.start) {
			return { start: undefined, end: undefined, allDay: false, timeZone: null }
		}
		if (!Notion.isDateTime(date.start)) {
			// All-day: Notion's `end` is the INCLUSIVE last day; mitra stores the exclusive next midnight.
			const lastDay = Temporal.PlainDate.from(date.end && !Notion.isDateTime(date.end) ? date.end : date.start)
			return {
				start: midnightOf(Temporal.PlainDate.from(date.start), 'UTC') as never,
				end: midnightOf(lastDay.add({ days: 1 }), 'UTC') as never,
				allDay: true,
				timeZone: null,
			}
		}
		const timeZone = date.time_zone ?? null
		return {
			start: Notion.instantFrom(date.start, timeZone) as never,
			end: date.end ? Notion.instantFrom(date.end, timeZone) as never : undefined,
			allDay: false,
			timeZone,
		}
	}

	/** An instant as `zone`'s wall-clock ISO string (no offset) — the form Notion pairs with `time_zone`. */
	private static wallClock(instant: Date, zone: string): string {
		return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'second' })
	}

	/** A canonical all-day bound's date as Notion's date-only string. */
	private static dateOnly(instant: Date): string {
		return calendarDateOf(instant, 'UTC').toString()
	}

	/** The reverse of {@link spanFrom}: mitra's span as a Notion date value (null clears the date). */
	static dateFrom(entry: Pick<Entry, 'start' | 'end' | 'allDay' | 'timeZone'>): NotionDate | null {
		if (!entry.start) {
			return null
		}
		if (entry.allDay) {
			const start = Notion.dateOnly(entry.start)
			// Exclusive next midnight → inclusive last day; a single-day task carries no end at all.
			const lastDay = entry.end ? calendarDateOf(entry.end, 'UTC').subtract({ days: 1 }) : undefined
			const end = lastDay && lastDay.toString() > start ? lastDay.toString() : null
			return { start, end, time_zone: null }
		}
		// A real IANA authoring zone rides along as Notion's time_zone (wall-clock form). A FLOATING
		// entry has no zone by definition — its as-if-UTC instants are written in the Z form, the
		// closest instant-preserving encoding Notion can hold.
		const zone = entry.timeZone && entry.timeZone !== FLOATING_TIME_ZONE ? entry.timeZone : null
		return {
			start: zone ? Notion.wallClock(entry.start, zone) : entry.start.toISOString(),
			end: entry.end ? (zone ? Notion.wallClock(entry.end, zone) : entry.end.toISOString()) : null,
			time_zone: zone,
		}
	}

	/**
	 * The Notion property writes for an entry — all mapped properties by default (create), or the
	 * subset an edit actually changed (update: see the diff in {@link updateEntry}). Throws on the
	 * one status Notion cannot represent rather than silently misfiling it.
	 */
	static propertiesFrom(
		entry: Entry,
		schema: NotionSchemaIndex,
		include: { heading: boolean, status: boolean, span: boolean } = { heading: true, status: true, span: true },
	): Record<string, NotionPropertyValue> {
		const properties: Record<string, NotionPropertyValue> = {}
		if (include.heading) {
			properties[schema.titleProperty] = { title: [{ text: { content: entry.heading } }] }
		}
		if (include.status && entry.status !== undefined) {
			if (entry.status === TaskStatus.Cancelled) {
				throw new Error('Notion does not support the cancelled task status')
			}
			const optionId = schema.optionByStatus.get(entry.status)
			if (!optionId) {
				throw new Error(`The Notion status property has no option to represent "${entry.status}"`)
			}
			properties[schema.statusProperty] = { status: { id: optionId } }
		}
		if (include.span) {
			properties[schema.dateProperty] = { date: Notion.dateFrom(entry) }
		}
		return properties
	}

	/**
	 * Apply a page onto an entry — the ONE decoder every read path (sync, create echo, update echo)
	 * goes through. Every mapped field is assigned so a re-import rebuilds rows exactly; fields
	 * Notion cannot hold are cleared, never left over from a previous life (e.g. a migrated entry).
	 *
	 * `description` is the page BODY's markdown — a page object doesn't carry its body, so callers
	 * hand in what their separate body fetch (or their own write) produced; absent means empty.
	 *
	 * `localWrite` stamps `data.localWriteAt` with OUR clock — set by the create/update paths (a page
	 * we just wrote), never by a plain sync read: it's the freshness signal the deletion guard reads,
	 * and keeping it on our own clock is what makes that guard immune to server↔Notion clock skew.
	 *
	 * `relations` likewise comes from the caller, which alone knows the lines Notion cannot hold
	 * ({@link retainedRelations}) and whether a truncated value could be completed. PRESENT-BUT-
	 * UNDEFINED is meaningful, and distinct from an absent key: it leaves the relation table alone
	 * (the tri-state seam's "no authority here"), whereas an absent key takes the page at face value.
	 */
	static applyPage(entry: Entry, page: NotionPage, schema: NotionSchemaIndex, options?: { description?: string, localWrite?: boolean, relations?: Array<Relation> | null }): void {
		entry.type = EntryType.Task
		entry.uri = page.id
		// The page id IS the uid: a Notion relation value names a page, mitra's names a uid, and this
		// is what makes them the same word — so a related page no enabled view mirrors dangles (as
		// the model intends) instead of being untranslatable. The cost is that an entry MOVED into
		// Notion cannot keep its uid; createEntry re-points what pointed at the old one.
		entry.uid = page.id
		entry.relations = options && 'relations' in options ? options.relations : Notion.relationsFrom(page, schema)
		entry.heading = Notion.plainText(page.properties[schema.titleProperty]?.title) || 'Untitled Task'
		const option = page.properties[schema.statusProperty]?.status
		entry.status = (option?.id ? schema.statusByOption.get(option.id) : undefined) ?? TaskStatus.ToDo
		const span = Notion.spanFrom(page.properties[schema.dateProperty]?.date)
		entry.start = span.start
		entry.end = span.end
		entry.allDay = span.allDay
		entry.timeZone = span.timeZone
		entry.description = options?.description ?? ''
		// Unrepresentable in Notion — kept explicitly empty (see the class doc).
		entry.location = ''
		entry.color = null
		entry.reminders = null
		entry.recurrence = null
		// `etag`-equivalent: the page's own edit stamp, what the sync's skip check compares. The url
		// is kept for a future "open in Notion" affordance. `localWriteAt` (our clock) is recorded only
		// when WE authored this write, so the deletion guard can spare a just-created row.
		entry.data = { etag: page.last_edited_time, url: page.url, ...(options?.localWrite ? { localWriteAt: Date.now() } : {}) }
	}
}
