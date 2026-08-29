import { type EntityManager } from '@mikro-orm/sqlite'
import { converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { model } from '../../infrastructure/model/model.js'
import { EntryRelations } from '../../features/relations/EntryRelations.js'
import { Integration, integration, withheld } from '../Integration.js'
import { Source } from '../../features/sources/Source.js'
import { Entry, TaskStatus, FLOATING_TIME_ZONE } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { calendarDateOf, midnightOf } from '../../features/time/calendarDate.js'
import { Color } from '../../features/sources/Color.js'
import { type Relation } from '../../features/relations/Relation.js'
import { RelationType } from '../../features/relations/RelationType.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { createLogger } from '../../infrastructure/logging/Logger.js'
import { NotionClient, NotionRequestError, type NotionBlock, type NotionDataSource, type NotionDate, type NotionPage, type NotionPropertyCondition, type NotionPropertyValue, type NotionRichText, type NotionView, type NotionViewFilter } from './NotionClient.js'
import { NotionMarkdown } from './NotionMarkdown.js'

const logger = createLogger('Notion')

export interface NotionCredentials {
	/** Workspace display label captured from bot user. */
	username: string
	/** Internal integration or personal access token. */
	token: string
}

/** Schema index mapping Notion database properties to Entry fields. */
export interface NotionSchemaIndex {
	titleProperty: string
	statusProperty: string
	dateProperty: string
	/** Status option id → TaskStatus. */
	statusByOption: ReadonlyMap<string, TaskStatus>
	/** TaskStatus → first option id in group. */
	optionByStatus: ReadonlyMap<TaskStatus, string>
	/** Self-referencing relation properties mapped to RelationType. */
	relationProperties: ReadonlyArray<NotionRelationProperty>
}

/** Mapped self-referencing relation property and its corresponding RelationType. */
export interface NotionRelationProperty {
	name: string
	id: string
	type: RelationType
}

/**
 * Notion integration mapping database views to task sources.
 * Pages map to tasks with bi-directional markdown descriptions and self-referencing relations.
 */
@model('Notion')
@integration('notion')
export class Notion extends Integration<NotionCredentials> {
	static readonly label: string = 'Notion'
	static readonly logo: string = 'notion'
	static readonly description: string = 'The task databases of your workspace'

	static readonly uriPrefix = 'notion://'

	private static readonly sourceViewTypes = new Set(['table', 'board', 'list', 'calendar', 'timeline', 'gallery'])

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

	@converter(withheld<NotionCredentials>('token')) override credentials!: NotionCredentials

	constructor(init?: Partial<Notion>) {
		super()
		this.credentials = { username: '', token: '' }
		Object.assign(this, init)
	}

	override toString() {
		return `Notion integration for "${this.credentials.username || this.uri || '(new)'}"`
	}

	override get capabilities() {
		return {
			...Integration.fullCapabilities,
			recurrence: false, reminders: false, location: false, cancelledStatus: false,
			percentComplete: false, timeZone: false, participants: false, transparency: false,
			visibility: false,
		}
	}

	override get canConnect() {
		return !!this.credentials.token
	}

	override get syncInterval() { return 60_000 }

	override merge(incoming: this) {
		this.credentials = {
			username: this.credentials.username ?? '',
			token: incoming.credentials?.token || this.credentials.token,
		}
	}

	@converter({ out: {} }) private client?: NotionClient

	protected createClient(): NotionClient {
		return new NotionClient(this.credentials.token)
	}

	protected getClient(): NotionClient {
		return this.client ??= this.createClient()
	}

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

		const me = await client.me()
		this.uri = `${Notion.uriPrefix}${me.id}`
		this.credentials = { ...this.credentials, username: me.bot?.workspace_name || me.name || 'Notion' }

		const dataSources = await client.searchDataSources()
		if (!dataSources.length) {
			throw new Error('No databases are shared with this Notion connection — open a database in Notion and add the connection under ••• → Connections')
		}
		const sources: Array<Source> = []
		for (const found of dataSources) {
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

	private static readonly watermarkOverlapMs = 2 * 60_000

	/** Performs full-membership and incremental-content sync for a Notion view source. */
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

		await EntryRelation.loadFor(em, existing)
		const pageIds = await this.dataSourcePageIds(em, dataSourceId, memberIds)
		const isPage = (uid: string) => pageIds.has(uid)
		const applied: Array<Entry> = []

		let changed = false

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

		for (const id of memberIds) {
			const entry = existingByUri.get(id)
			let page = editedPages.get(id)
			if (!page) {
				if (entry) {
					continue
				}
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
				continue
			}
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
			if (!before || !before.editEquals(target) || (target.relations !== undefined && before.relationList.writesDiffer(target.relationList))) {
				changed = true
			}
		}

		await this.reconcileRelations(em, applied)

		const newest = [...editedPages.values()].map(page => page.last_edited_time).sort().at(-1)
		if (newest && (!watermark || newest > watermark)) {
			source.syncState = { ...source.syncState, lastEditedAfter: newest }
		}

		logger.debug(`Synced "${source.name}": ${memberIds.size} member(s), ${editedPages.size} edited${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	/** Collects page IDs belonging to this data source to determine relation ownership. */
	private async dataSourcePageIds(em: EntityManager, dataSourceId: string, memberIds: Iterable<string> = []): Promise<Set<string>> {
		const sourceIds = (await em.find(Source, { integrationId: this.id }))
			.filter(source => source.uri.startsWith(`${Notion.uriPrefix}${dataSourceId}/`))
			.map(source => source.id)
		const entries = sourceIds.length ? await em.find(Entry, { sourceId: { $in: sourceIds } }) : []
		return new Set([...memberIds, ...entries.flatMap(entry => entry.uri ? [entry.uri] : [])])
	}

	/** Decodes relations from page properties, completing paginated relations when needed. */
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
		return { relations: Notion.relationsFrom(page, schema, Notion.retainedRelations(EntryRelations.of(undefined, stored).writes, schema, isPage)) }
	}

	// --- Entry CRUD ---------------------------------------------------------------------------------

	override async createEntry(em: EntityManager, entry: Entry): Promise<Entry> {
		if (entry.recurrence) {
			throw new Error('Notion does not support recurring tasks')
		}
		const source = await em.findOneOrFail(Source, { id: entry.sourceId })
		const { dataSourceId, viewId } = Notion.idsOf(source)
		const schema = await this.schemaFor(source)
		const dataSource = await this.dataSource(dataSourceId)

		const filterDefaults = await this.getClient().view(viewId).then(view => Notion.deriveFilterDefaults(view, dataSource)).catch(error => {
			logger.warn(`Could not read the filter of view ${viewId} to pre-fill a new task — creating without it: ${error instanceof Error ? error.message : error}`)
			return {} as Record<string, NotionPropertyValue>
		})
		const pageIds = schema.relationProperties.length ? await this.dataSourcePageIds(em, dataSourceId) : new Set<string>()
		const isPage = (uid: string) => pageIds.has(uid)
		const properties = { ...filterDefaults, ...Notion.propertiesFrom(entry, schema), ...Notion.changedRelationProperties(null, entry.relationList.writes, schema, isPage) }
		const blocks = entry.description ? NotionMarkdown.toBlocks(entry.description) : []
		const page = await this.getClient().createPage(dataSourceId, properties, blocks.slice(0, Notion.maxBlocksPerWrite))
		for (let index = Notion.maxBlocksPerWrite; index < blocks.length; index += Notion.maxBlocksPerWrite) {
			await this.getClient().appendBlockChildren(page.id, blocks.slice(index, index + Notion.maxBlocksPerWrite))
		}
		const previousUid = entry.uid
		Notion.applyPage(entry, page, schema, { description: NotionMarkdown.toMarkdown(blocks), localWrite: true, ...await this.relationsOf(page, schema, entry.relations, isPage) })
		em.persist(entry)
		await Notion.repointRelations(em, previousUid, entry.uid!)
		return entry
	}

	/** Rewrites EntryRelation rows when an entry receives a newly minted Notion page UID on move. */
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
		const headingChanged = existing.heading !== incoming.heading
		const statusChanged = existing.status !== incoming.status
		const descriptionChanged = (existing.description ?? '') !== (incoming.description ?? '')
		const spanChanged = (['start', 'end', 'allDay', 'timeZone'] as const).some(key => !Object[equals](existing[key], incoming[key]))
		const relationsChanged = incoming.relations !== undefined && existing.relationList.writesDiffer(incoming.relationList)
		if (!headingChanged && !statusChanged && !spanChanged && !descriptionChanged && !relationsChanged) {
			return
		}
		const source = await em.findOneOrFail(Source, { id: existing.sourceId })
		const schema = await this.schemaFor(source)
		const desiredRelations = EntryRelations.of(undefined, relationsChanged ? incoming.relations ?? null : existing.relations).writes
		const pageIds = schema.relationProperties.length
			? await this.dataSourcePageIds(em, Notion.idsOf(source).dataSourceId)
			: new Set<string>()
		const isPage = (uid: string) => pageIds.has(uid)
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
			return
		}
		const page = Object.keys(properties).length
			? await this.getClient().updatePage(existing.uri, properties)
			: await this.getClient().page(existing.uri)
		Notion.applyPage(existing, page, schema, { description, localWrite: true, ...await this.relationsOf(page, schema, desiredRelations, isPage) })
		await this.syncSiblingRows(em, existing, page, schema, description, isPage)
	}

	/** Synchronizes page updates to sibling rows representing other views of the same database. */
	private async syncSiblingRows(em: EntityManager, written: Entry, page: NotionPage, schema: NotionSchemaIndex, description: string | undefined, isPage: (uid: string) => boolean): Promise<void> {
		const siblings = await this.siblingRows(em, written)
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
				if (!(error instanceof NotionRequestError) || error.status !== 404) {
					throw error
				}
			}
			for (const sibling of await this.siblingRows(em, entry)) {
				em.remove(sibling)
			}
		}
		em.remove(entry)
	}

	override excludeOccurrence(): Promise<void> {
		return Promise.reject(new Error('Notion does not support recurring tasks'))
	}

	// --- Page body ↔ description ----------------------------------------------------------------------

	private static readonly maxBlocksPerWrite = 100

	/** Fetches page body blocks recursively up to maximum nesting depth. */
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

	/** Replaces replaceable markdown blocks in page body while preserving unsupported/embed blocks. */
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
		return (richText ?? []).map(run => NotionMarkdown.textOf(run)).join('')
	}

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

	/** Identifies self-referencing relation properties in schema that map to RelationType. */
	static relationPropertiesOf(dataSource: NotionDataSource): Array<NotionRelationProperty> {
		const candidates = Object.values(dataSource.properties ?? {})
			.filter(property => property.type === 'relation' && (property.relation?.data_source_id === dataSource.id
				|| (!!property.relation?.database_id && property.relation.database_id === dataSource.parent?.database_id)))
			.map(property => ({ property, type: Notion.relationTypeOf(property.name) }))

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

	/** Decodes outgoing relations from page properties plus retained non-Notion relations. */
	static relationsFrom(page: NotionPage, schema: NotionSchemaIndex, retained: ReadonlyArray<Relation> = []): Array<Relation> | null {
		return EntryRelations.of(undefined, [
			...schema.relationProperties.flatMap(property => (page.properties[property.name]?.relation ?? [])
				.filter(reference => reference.id !== page.id)
				.map(reference => ({ type: property.type, targetUid: reference.id }))),
			...retained,
		]).value
	}

	/** Returns stored relations pointing outside this database or with unmapped types. */
	static retainedRelations(stored: ReadonlyArray<Relation> | null | undefined, schema: NotionSchemaIndex, isPage: (uid: string) => boolean): Array<Relation> {
		return (stored ?? []).filter(relation => !isPage(relation.targetUid)
			|| !schema.relationProperties.some(property => property.type === RelationType.of(relation.type)))
	}

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

	static changedRelationProperties(existing: ReadonlyArray<Relation> | null | undefined, incoming: ReadonlyArray<Relation> | null | undefined, schema: NotionSchemaIndex, isPage: (uid: string) => boolean): Record<string, NotionPropertyValue> {
		const ids = (value: NotionPropertyValue | undefined) => (value?.relation ?? []).map(reference => reference.id).join(' ')
		const before = Notion.relationPropertiesFrom(existing, schema, isPage)
		const after = Notion.relationPropertiesFrom(incoming, schema, isPage)
		return Object.fromEntries(Object.entries(after).filter(([name, value]) => ids(value) !== ids(before[name])))
	}

	/** Derives property write defaults from view filter conditions for new pages. */
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
				node.and.forEach(walk)
			} else if ('or' in node) {
				return
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

	private static isDateTime(value: string): boolean {
		return value.includes('T')
	}

	private static hasOffset(value: string): boolean {
		return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
	}

	private static instantFrom(value: string, timeZone: string | null | undefined): Date {
		if (!Notion.isDateTime(value)) {
			return midnightOf(Temporal.PlainDate.from(value), 'UTC')
		}
		if (timeZone && !Notion.hasOffset(value)) {
			return new Date(Temporal.PlainDateTime.from(value).toZonedDateTime(timeZone, { disambiguation: 'compatible' }).epochMilliseconds)
		}
		return new Date(value)
	}

	/** Decodes Notion date property value into start/end span and timeZone. */
	static spanFrom(date: NotionDate | null | undefined): Pick<Entry, 'start' | 'end' | 'allDay' | 'timeZone'> {
		if (!date?.start) {
			return { start: undefined, end: undefined, allDay: false, timeZone: null }
		}
		if (!Notion.isDateTime(date.start)) {
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

	private static wallClock(instant: Date, zone: string): string {
		return Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone).toPlainDateTime().toString({ smallestUnit: 'second' })
	}

	private static dateOnly(instant: Date): string {
		return calendarDateOf(instant, 'UTC').toString()
	}

	/** Encodes entry span into Notion date property value. */
	static dateFrom(entry: Pick<Entry, 'start' | 'end' | 'allDay' | 'timeZone'>): NotionDate | null {
		if (!entry.start) {
			return null
		}
		if (entry.allDay) {
			const start = Notion.dateOnly(entry.start)
			const lastDay = entry.end ? calendarDateOf(entry.end, 'UTC').subtract({ days: 1 }) : undefined
			const end = lastDay && lastDay.toString() > start ? lastDay.toString() : null
			return { start, end, time_zone: null }
		}
		const zone = entry.timeZone && entry.timeZone !== FLOATING_TIME_ZONE ? entry.timeZone : null
		return {
			start: zone ? Notion.wallClock(entry.start, zone) : entry.start.toISOString(),
			end: entry.end ? (zone ? Notion.wallClock(entry.end, zone) : entry.end.toISOString()) : null,
			time_zone: zone,
		}
	}

	/** Serializes entry fields to Notion property values. */
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

	/** Maps Notion page properties, body, and relations onto an Entry instance. */
	static applyPage(entry: Entry, page: NotionPage, schema: NotionSchemaIndex, options?: { description?: string, localWrite?: boolean, relations?: Array<Relation> | null }): void {
		entry.type = EntryType.Task
		entry.uri = page.id
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
		entry.percentComplete = null
		entry.location = ''
		entry.color = null
		entry.reminders = null
		entry.recurrence = null
		entry.data = { etag: page.last_edited_time, url: page.url, ...(options?.localWrite ? { localWriteAt: Date.now() } : {}) }
	}
}
