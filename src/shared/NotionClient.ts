import { createLogger } from './Logger.js'

const logger = createLogger('Notion')

/** The pinned API version every request declares (Notion's API is date-versioned and the header is
 * mandatory). 2026-03-11 is the first version documenting the view endpoints; it also renames
 * `archived` to `in_trash` across objects — the shapes below follow it. */
export const NOTION_VERSION = '2026-03-11'

// --- Wire shapes (only the fields mitra reads — Notion objects carry many more) ---------------------

/** A rich text run. Reading only ever concatenates `plain_text`; writing sends bare text runs. */
export interface NotionRichText {
	plain_text?: string
	text?: { content: string }
}

/** A date property value. `start`/`end` are ISO 8601 — date-only ("2026-07-14") marks an all-day
 * value; with a clock they carry a UTC offset UNLESS `time_zone` (an IANA id) is set, in which case
 * they are that zone's wall clock and must carry no offset. */
export interface NotionDate {
	start: string
	end?: string | null
	time_zone?: string | null
}

export interface NotionStatusOption {
	id: string
	name: string
}

/** A page's property value, keyed by its `type`. Only the types mitra maps are modelled; writes
 * send the same shapes with only the identifying fields (e.g. a status by option id alone). The
 * `select`/`multi_select` shapes are write-only here — mitra reads none of them, but fills them
 * when a view's filter demands a value for a page to appear in it (see {@link deriveFilterDefaults}). */
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
}

export interface NotionPage {
	object: 'page'
	id: string
	last_edited_time: string
	in_trash?: boolean
	url?: string
	properties: Record<string, NotionPropertyValue>
}

/** A data source's schema property (the config side of {@link NotionPropertyValue}). The status
 * config carries the option→group structure a page value omits. */
export interface NotionSchemaProperty {
	id: string
	name: string
	type: string
	status?: {
		options: Array<NotionStatusOption>
		groups: Array<{ id: string, name: string, option_ids: Array<string> }>
	}
}

/** A data source — the queryable unit holding schema and rows; a database is just its container. */
export interface NotionDataSource {
	object: 'data_source'
	id: string
	title?: Array<NotionRichText>
	properties: Record<string, NotionSchemaProperty>
}

/**
 * A single property condition (the leaf of a saved `filter` tree, or the value of a `quick_filters`
 * entry). Only the operators mitra can SATISFY by writing a value are modelled — creating a page into
 * a view means matching its filter. Everything else (ranges, `is_empty`, `does_not_equal`, text
 * `contains`, formulas…) is left unmodelled and ignored. `relation.contains` names the page a
 * relation must include — exactly the "Area = University" shape real Notion task views use. */
export interface NotionPropertyCondition {
	select?: { equals?: string }
	status?: { equals?: string }
	multi_select?: { contains?: string }
	checkbox?: { equals?: boolean }
	relation?: { contains?: string }
}

/** A saved view filter: an `and`/`or` tree, or a leaf that also carries its property reference (a
 * schema id OR name). */
export type NotionViewFilter =
	| { and: Array<NotionViewFilter> }
	| { or: Array<NotionViewFilter> }
	| (NotionPropertyCondition & { property: string })

/** The view's quick-filter chips: a flat map of raw property id → condition. Real Notion task views
 * keep their filtering here (the top-level `filter` is often null), so pre-fill reads both. */
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

/** The bot user behind a token (`GET /users/me`) — what labels and identifies a connection. */
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
	/** Query endpoints cap at 10,000 results and declare truncation here rather than erroring. */
	request_status?: { type: 'complete' | 'incomplete', incomplete_reason?: string }
}

/** A view query handle (`POST /views/{id}/queries`): the first results page rides along; further
 * pages are read off the query id. The cache behind it expires server-side after ~15 minutes. */
interface NotionViewQuery extends NotionList<{ object: string, id: string }> {
	id: string
}

/** A Notion API error body. */
interface NotionError {
	code?: string
	message?: string
}

export class NotionRequestError extends Error {
	constructor(readonly status: number, readonly code: string | undefined, message: string) {
		super(message)
	}
}

/**
 * A minimal typed client for the Notion REST API — bearer token + pinned {@link NOTION_VERSION},
 * JSON in/out, Notion's own error messages surfaced, and one polite retry on 429 honouring
 * `Retry-After`. Deliberately not the official SDK: mitra touches a handful of endpoints, and a
 * ~100-line client keeps the wire shapes (and their tests) in one visible place.
 *
 * The endpoint methods below mirror Notion's own nouns; the task semantics (what a page MEANS)
 * live in Notion.ts, keeping this file purely protocol.
 */
export class NotionClient {
	static readonly baseUrl = 'https://api.notion.com/v1/'

	/** How long a 429's Retry-After is honoured at most — anything longer fails the sync cycle
	 * instead of stalling the whole (single-threaded) synchronizer loop. */
	private static readonly maxRetryAfterSeconds = 30

	/** `fetchImplementation` is injectable for tests; defaults to the runtime's fetch. */
	constructor(
		private readonly token: string,
		private readonly fetchImplementation: typeof fetch = fetch,
	) { }

	private async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, isRetry = false): Promise<T> {
		const response = await this.fetchImplementation(new URL(path, NotionClient.baseUrl), {
			method,
			headers: {
				'Authorization': `Bearer ${this.token}`,
				'Notion-Version': NOTION_VERSION,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})

		// 429 is the per-connection limit, 529 the service-overload variant — both carry Retry-After.
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

	/** Drain a cursor-paginated listing. `page` maps a cursor to one page of results. */
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

	/** The bot user the token authenticates as — the connection's identity and workspace label.
	 * Also the cheapest "is this token valid" probe. */
	me(): Promise<NotionBotUser> {
		return this.request('GET', 'users/me')
	}

	/** Every data source shared with the connection (Notion has no list-databases endpoint —
	 * search with an object filter is the enumeration mechanism). */
	searchDataSources(): Promise<Array<NotionDataSource>> {
		return this.paginate(cursor => this.request('POST', 'search', {
			filter: { property: 'object', value: 'data_source' },
			...(cursor ? { start_cursor: cursor } : {}),
			page_size: 100,
		}))
	}

	/** A data source's schema — the `properties` map (status options/groups, property types). */
	dataSource(dataSourceId: string): Promise<NotionDataSource> {
		return this.request('GET', `data_sources/${dataSourceId}`)
	}

	/** The views of a data source. The listing returns partial objects (often bare ids), so each
	 * view is retrieved individually when its name/type didn't ride along. A view whose type Notion's
	 * own API refuses to serialize (`400 validation_error: Unsupported view type: feed`, and any
	 * future kind like it) is DROPPED, not fatal: such a view can never be a task source, and letting
	 * one unsupported view abort retrieval would break discovery — and every sync — for the whole
	 * account (the reported "cannot do anything with Notion" bug). Other errors still propagate. */
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

	/**
	 * The ids of every page the view currently contains — Notion evaluates the view's own
	 * filter/sorts server-side (mitra never re-implements filter semantics). Membership being the
	 * complete current state is what makes remote deletions (and pages drifting out of a filtered
	 * view) detectable as a set difference — so `complete` reports whether it really is: the query
	 * cache caps at 10,000 results, and a truncated membership must never drive deletions.
	 */
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

	/** Full page objects of a data source, optionally only those edited at/after `editedOnOrAfter`
	 * (the incremental-sync filter; timestamp filters take no `property` key). Ascending edit-time
	 * order on purpose: this query shares the 10,000-result cap, and ascending order means a
	 * truncation drops the NEWEST edits — the caller's watermark (the max edit stamp actually
	 * seen) then stays behind the dropped ones, so the next cycle picks them up. */
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

	createPage(dataSourceId: string, properties: Record<string, NotionPropertyValue>): Promise<NotionPage> {
		return this.request('POST', 'pages', {
			parent: { type: 'data_source_id', data_source_id: dataSourceId },
			properties,
		})
	}

	updatePage(pageId: string, properties: Record<string, NotionPropertyValue>): Promise<NotionPage> {
		return this.request('PATCH', `pages/${pageId}`, { properties })
	}

	/** Notion has no hard delete over the API — trashing (`in_trash`; `archived` is the legacy
	 * spelling) is the deletion semantic. */
	trashPage(pageId: string): Promise<NotionPage> {
		return this.request('PATCH', `pages/${pageId}`, { in_trash: true })
	}
}
