import { type EntityManager } from '@mikro-orm/sqlite'
import { equals } from '@a11d/equals'
import { model } from './model.js'
import { Integration, integration } from './Integration.js'
import { Source, SourceType } from './Source.js'
import { Entry, EntryType, TaskStatus, FLOATING_TIME_ZONE } from './Entry.js'
import { calendarDateOf, midnightOf } from './calendarDate.js'
import { Color } from './Color.js'
import { createLogger } from './Logger.js'
import { NotionClient, NotionRequestError, type NotionDataSource, type NotionDate, type NotionPage, type NotionPropertyCondition, type NotionPropertyValue, type NotionRichText, type NotionView, type NotionViewFilter } from './NotionClient.js'

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
}

/**
 * Notion integration: DATABASE VIEWS as task sources. Notion is not a calendar — its unit of
 * scheduling is a page in a database — so this integration models exactly what Notion can express:
 *
 * - Every view of every shared task database (one with a status AND a date property) becomes a
 *   selectable {@link SourceType.Task} source. Views are the right grain because Notion evaluates
 *   their filters server-side ("My tasks", "This sprint") — mitra never re-implements filter
 *   semantics, it just asks the view for its members.
 * - Pages map to task entries: title ↔ heading, status option ↔ task status via the schema's
 *   option groups, the date property ↔ start/end (date-only values are all-day, zoned date-times
 *   keep their IANA zone).
 * - NOT expressible in Notion, deliberately absent rather than approximated: recurrence (the API
 *   has no repeat concept — writes carrying a rule are rejected so a series is never silently
 *   collapsed), the cancelled status (Notion's groups are to-do/in-progress/complete), reminders,
 *   location, and description (a page's body is collaborative block content — wholesale rewriting
 *   it from a plain-text field would be destructive). See {@link capabilities}, which the editor
 *   uses to hide those fields for entries living here.
 * - Dependencies (sub-tasks, blocked-by) are not modelled YET; when they are, a re-import
 *   (the existing {@link Integration.resyncSource} hatch) rebuilds entries from Notion, so
 *   already-connected sources pick the new fields up without migration ceremony.
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

	declare credentials: NotionCredentials

	constructor(init?: Partial<Notion>) {
		super()
		Object.assign(this, init)
	}

	// A fixed label (like GoogleCalendar's): the STI discriminator isn't populated on fresh instances.
	override toString() {
		return `Notion integration for "${this.credentials.username || this.uri || '(new)'}"`
	}

	/** Nothing Notion models can hold these — the editor hides the fields (and the write mapping
	 * rejects recurrence/cancelled) instead of silently dropping edits. `timeZone: false` because
	 * Notion's date property can't store a named IANA zone: its API resolves any `time_zone` to a
	 * fixed offset and returns `time_zone: null`, so a per-entry authoring zone would silently vanish
	 * on save (the times still show correctly in the viewer's zone — that's a view concern). */
	override get capabilities() {
		return { recurrence: false, reminders: false, location: false, description: false, cancelledStatus: false, timeZone: false }
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

	protected override get editableCredentials(): NotionCredentials {
		return { username: this.credentials.username, token: '' }
	}

	/** The token is a server-side secret: the API (and the edit dialog) only ever see the label. */
	toJSON() {
		return { ...this, client: undefined, dataSources: undefined, credentials: { username: this.credentials.username } }
	}

	private client?: NotionClient

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
	private dataSources?: Map<string, Promise<NotionDataSource>>

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
					type: SourceType.Task,
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
			const before = entry?.clone()
			const target = entry ?? new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: page.id })
			if (!entry) {
				em.persist(target)
			}
			Notion.applyPage(target, page, schema)
			if (!before || !before.editEquals(target)) {
				changed = true
			}
		}

		// The watermark advances to the newest edit actually seen — never to "now", whose clock is
		// ours, not Notion's. Bookkeeping only: it must not count as a change (see Integration).
		const newest = [...editedPages.values()].map(page => page.last_edited_time).sort().at(-1)
		if (newest && (!watermark || newest > watermark)) {
			source.syncState = { ...source.syncState, lastEditedAfter: newest }
		}

		logger.debug(`Synced "${source.name}": ${memberIds.size} member(s), ${editedPages.size} edited${changed ? '' : ' (no local changes)'}`)
		return changed
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
		const properties = { ...filterDefaults, ...Notion.propertiesFrom(entry, schema) }
		const page = await this.getClient().createPage(dataSourceId, properties)
		Notion.applyPage(entry, page, schema, true)
		em.persist(entry)
		return entry
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
		const spanChanged = (['start', 'end', 'allDay', 'timeZone'] as const).some(key => !Object[equals](existing[key], incoming[key]))
		if (!headingChanged && !statusChanged && !spanChanged) {
			return
		}
		const source = await em.findOneOrFail(Source, { id: existing.sourceId })
		const schema = await this.schemaFor(source)
		const properties = Notion.propertiesFrom(incoming, schema, {
			heading: headingChanged,
			status: statusChanged,
			span: spanChanged,
		})
		const page = await this.getClient().updatePage(existing.uri, properties)
		Notion.applyPage(existing, page, schema, true)
		await this.syncSiblingRows(em, existing, page, schema)
	}

	/**
	 * Mirror a page write onto the OTHER rows carrying the same page — one exists per enabled view
	 * containing it (overlapping views are a deliberate choice, see the add dialog). Without this, an
	 * edit through one view leaves its twin stale for up to a sync interval — the CalDAV counterpart
	 * is syncResourceRows. Scoped to this integration's sources, mirroring CalDAV's sibling scoping.
	 */
	private async syncSiblingRows(em: EntityManager, written: Entry, page: NotionPage, schema: NotionSchemaIndex): Promise<void> {
		for (const sibling of await this.siblingRows(em, written)) {
			Notion.applyPage(sibling, page, schema, true)
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

		return { titleProperty: title.name, statusProperty: status.name, dateProperty: date.name, statusByOption, optionByStatus }
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
	 * `localWrite` stamps `data.localWriteAt` with OUR clock — set by the create/update paths (a page
	 * we just wrote), never by a plain sync read: it's the freshness signal the deletion guard reads,
	 * and keeping it on our own clock is what makes that guard immune to server↔Notion clock skew.
	 */
	static applyPage(entry: Entry, page: NotionPage, schema: NotionSchemaIndex, localWrite = false): void {
		entry.type = EntryType.Task
		entry.uri = page.id
		entry.heading = Notion.plainText(page.properties[schema.titleProperty]?.title) || 'Untitled Task'
		const option = page.properties[schema.statusProperty]?.status
		entry.status = (option?.id ? schema.statusByOption.get(option.id) : undefined) ?? TaskStatus.ToDo
		const span = Notion.spanFrom(page.properties[schema.dateProperty]?.date)
		entry.start = span.start
		entry.end = span.end
		entry.allDay = span.allDay
		entry.timeZone = span.timeZone
		// Unrepresentable in Notion — kept explicitly empty (see the class doc).
		entry.description = ''
		entry.location = ''
		entry.color = null
		entry.reminders = null
		entry.recurrence = null
		// `etag`-equivalent: the page's own edit stamp, what the sync's skip check compares. The url
		// is kept for a future "open in Notion" affordance. `localWriteAt` (our clock) is recorded only
		// when WE authored this write, so the deletion guard can spare a just-created row.
		entry.data = { etag: page.last_edited_time, url: page.url, ...(localWrite ? { localWriteAt: Date.now() } : {}) }
	}
}
