import { createLogger } from '../../infrastructure/logging/Logger.js'

const logger = createLogger('Notion')

/** Pinned Notion API version header. */
export const NOTION_VERSION = '2026-03-11'

// --- Wire shapes ----------------------------------------------------------------------------------

export interface NotionAnnotations {
	bold?: boolean
	italic?: boolean
	strikethrough?: boolean
	underline?: boolean
	code?: boolean
}

/** Rich text run payload. */
export interface NotionRichText {
	type?: string
	plain_text?: string
	href?: string | null
	annotations?: NotionAnnotations
	text?: { content: string, link?: { url: string } | null }
	mention?: { type?: string, date?: NotionDate | null }
}

/** Notion date property value with ISO 8601 strings and optional IANA time_zone. */
export interface NotionDate {
	start: string
	end?: string | null
	time_zone?: string | null
}

export interface NotionStatusOption {
	id: string
	name: string
}

/** Page property value keyed by type. */
export interface NotionPropertyValue {
	id?: string
	type?: string
	title?: Array<NotionRichText>
	status?: Partial<NotionStatusOption> | null
	date?: NotionDate | null
	checkbox?: boolean
	select?: { name: string } | null
	multi_select?: Array<{ name: string }>
	relation?: Array<{ id: string }>
	/** Set on a relation value Notion truncated at 25 items. */
	has_more?: boolean
}

export interface NotionPage {
	object: 'page'
	id: string
	last_edited_time: string
	in_trash?: boolean
	url?: string
	properties: Record<string, NotionPropertyValue>
}

/** Content payload of a block across supported block types. */
export interface NotionBlockContent {
	rich_text?: Array<NotionRichText>
	checked?: boolean
	language?: string
	color?: string
	table_width?: number
	has_column_header?: boolean
	cells?: Array<Array<NotionRichText>>
	url?: string
	caption?: Array<NotionRichText>
	children?: Array<NotionBlock>
}

/** Page body block. */
export interface NotionBlock {
	object?: 'block'
	id?: string
	type: string
	has_children?: boolean
	paragraph?: NotionBlockContent
	heading_1?: NotionBlockContent
	heading_2?: NotionBlockContent
	heading_3?: NotionBlockContent
	bulleted_list_item?: NotionBlockContent
	numbered_list_item?: NotionBlockContent
	to_do?: NotionBlockContent
	quote?: NotionBlockContent
	callout?: NotionBlockContent
	code?: NotionBlockContent
	divider?: Record<string, never>
	table?: NotionBlockContent
	table_row?: NotionBlockContent
	bookmark?: NotionBlockContent
}

/** Data source schema property configuration. */
export interface NotionSchemaProperty {
	id: string
	name: string
	type: string
	status?: {
		options: Array<NotionStatusOption>
		groups: Array<{ id: string, name: string, option_ids: Array<string> }>
	}
	relation?: {
		data_source_id?: string
		database_id?: string
		type?: string
		dual_property?: { synced_property_id?: string, synced_property_name?: string }
	}
}

/** Queryable Notion data source containing schema and row definitions. */
export interface NotionDataSource {
	object: 'data_source'
	id: string
	title?: Array<NotionRichText>
	parent?: { database_id?: string }
	properties: Record<string, NotionSchemaProperty>
}

/** Single property filter condition. */
export interface NotionPropertyCondition {
	select?: { equals?: string }
	status?: { equals?: string }
	multi_select?: { contains?: string }
	checkbox?: { equals?: boolean }
	relation?: { contains?: string }
}

/** Saved view filter tree or leaf condition. */
export type NotionViewFilter =
	| { and: Array<NotionViewFilter> }
	| { or: Array<NotionViewFilter> }
	| (NotionPropertyCondition & { property: string })

/** Quick filter property map on views. */
export type NotionQuickFilters = Record<string, NotionPropertyCondition>

export interface NotionView {
	object: 'view'
	id: string
	name?: string
	type?: string
	data_source_id?: string
	filter?: NotionViewFilter
	quick_filters?: NotionQuickFilters
}

/** Bot user information for the authenticated token. */
export interface NotionBotUser {
	object: 'user'
	id: string
	name?: string | null
	bot?: { workspace_name?: string | null }
}

interface NotionList<T> {
	object: 'list'
	results: Array<T>
	next_cursor?: string | null
	has_more?: boolean
	request_status?: { type: 'complete' | 'incomplete', incomplete_reason?: string }
}

interface NotionViewQuery extends NotionList<{ object: string, id: string }> {
	id: string
}

interface NotionError {
	code?: string
	message?: string
}

export class NotionRequestError extends Error {
	constructor(readonly status: number, readonly code: string | undefined, message: string) {
		super(message)
	}
}

/** HTTP client for the Notion REST API with token authorization and 429 backoff. */
export class NotionClient {
	static readonly baseUrl = 'https://api.notion.com/v1/'

	private static readonly maxRetryAfterSeconds = 30

	constructor(
		private readonly token: string,
		private readonly fetchImplementation: typeof fetch = fetch,
	) { }

	private async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, isRetry = false): Promise<T> {
		const response = await this.fetchImplementation(new URL(path, NotionClient.baseUrl), {
			method,
			headers: {
				'Authorization': `Bearer ${this.token}`,
				'Notion-Version': NOTION_VERSION,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})

		if ((response.status === 429 || response.status === 529) && !isRetry) {
			const retryAfter = Number(response.headers.get('Retry-After')) || 1
			if (retryAfter <= NotionClient.maxRetryAfterSeconds) {
				logger.debug(`Rate limited on ${path} — retrying in ${retryAfter}s`)
				await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
				return this.request<T>(method, path, body, true)
			}
		}

		if (!response.ok) {
			const error = await response.json().catch(() => undefined) as NotionError | undefined
			throw new NotionRequestError(response.status, error?.code, `Notion request failed (${response.status}${error?.code ? ` ${error.code}` : ''}): ${error?.message ?? response.statusText}`)
		}
		return await response.json() as T
	}

	private async paginate<T>(page: (cursor: string | undefined) => Promise<NotionList<T>>): Promise<Array<T>> {
		const results: Array<T> = []
		let cursor: string | undefined
		do {
			const list = await page(cursor)
			results.push(...list.results)
			cursor = list.has_more && list.next_cursor ? list.next_cursor : undefined
		} while (cursor)
		return results
	}

	me(): Promise<NotionBotUser> {
		return this.request('GET', 'users/me')
	}

	searchDataSources(): Promise<Array<NotionDataSource>> {
		return this.paginate(cursor => this.request('POST', 'search', {
			filter: { property: 'object', value: 'data_source' },
			...(cursor ? { start_cursor: cursor } : {}),
			page_size: 100,
		}))
	}

	dataSource(dataSourceId: string): Promise<NotionDataSource> {
		return this.request('GET', `data_sources/${dataSourceId}`)
	}

	/** Fetches views for a data source, skipping unsupported view types. */
	async views(dataSourceId: string): Promise<Array<NotionView>> {
		const listed = await this.paginate<NotionView>(cursor =>
			this.request('GET', `views?data_source_id=${encodeURIComponent(dataSourceId)}&page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`))
		const detailed = await Promise.all(listed.map(async view => {
			if (view.name && view.type) {
				return view
			}
			try {
				return await this.view(view.id)
			} catch (error) {
				if (error instanceof NotionRequestError && error.status === 400) {
					logger.debug(`Skipping view ${view.id}: ${error.message}`)
					return undefined
				}
				throw error
			}
		}))
		return detailed.filter((view): view is NotionView => view !== undefined)
	}

	view(viewId: string): Promise<NotionView> {
		return this.request('GET', `views/${viewId}`)
	}

	/** Fetches all page IDs in a view, noting if the query result was capped. */
	async viewPageIds(viewId: string): Promise<{ ids: Array<string>, complete: boolean }> {
		const query = await this.request<NotionViewQuery>('POST', `views/${viewId}/queries`, { page_size: 100 })
		const ids = query.results.map(result => result.id)
		let complete = query.request_status?.type !== 'incomplete'
		let cursor = query.has_more && query.next_cursor ? query.next_cursor : undefined
		while (cursor) {
			const page = await this.request<NotionList<{ id: string }>>('GET', `views/${viewId}/queries/${query.id}?start_cursor=${encodeURIComponent(cursor)}&page_size=100`)
			ids.push(...page.results.map(result => result.id))
			complete &&= page.request_status?.type !== 'incomplete'
			cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
		}
		return { ids, complete }
	}

	queryDataSourcePages(dataSourceId: string, editedOnOrAfter?: string): Promise<Array<NotionPage>> {
		return this.paginate(cursor => this.request('POST', `data_sources/${dataSourceId}/query`, {
			...(editedOnOrAfter ? { filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: editedOnOrAfter } } } : {}),
			sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }],
			...(cursor ? { start_cursor: cursor } : {}),
			page_size: 100,
		}))
	}

	page(pageId: string): Promise<NotionPage> {
		return this.request('GET', `pages/${pageId}`)
	}

	/** Fetches the full relation list for a relation property when truncated on the page object. */
	async pageRelation(pageId: string, propertyId: string): Promise<Array<{ id: string }>> {
		const items = await this.paginate<{ type?: string, relation?: { id?: string } }>(cursor =>
			this.request('GET', `pages/${pageId}/properties/${propertyId}?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`))
		return items.flatMap(item => item.relation?.id ? [{ id: item.relation.id }] : [])
	}

	blockChildren(blockId: string): Promise<Array<NotionBlock>> {
		return this.paginate(cursor =>
			this.request('GET', `blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`))
	}

	appendBlockChildren(blockId: string, children: Array<NotionBlock>): Promise<void> {
		return this.request('PATCH', `blocks/${blockId}/children`, { children }).then(() => undefined)
	}

	deleteBlock(blockId: string): Promise<void> {
		return this.request('DELETE', `blocks/${blockId}`).then(() => undefined)
	}

	createPage(dataSourceId: string, properties: Record<string, NotionPropertyValue>, children?: Array<NotionBlock>): Promise<NotionPage> {
		return this.request('POST', 'pages', {
			parent: { type: 'data_source_id', data_source_id: dataSourceId },
			properties,
			...(children?.length ? { children } : {}),
		})
	}

	updatePage(pageId: string, properties: Record<string, NotionPropertyValue>): Promise<NotionPage> {
		return this.request('PATCH', `pages/${pageId}`, { properties })
	}

	trashPage(pageId: string): Promise<NotionPage> {
		return this.request('PATCH', `pages/${pageId}`, { in_trash: true })
	}
}
