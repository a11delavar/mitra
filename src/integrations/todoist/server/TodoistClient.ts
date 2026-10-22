import { createLogger } from '#infrastructure/logging/Logger.js'
import { type TodoistCommand, type TodoistPlanLimits, type TodoistProject, type TodoistTask, type TodoistUser } from '../Todoist.js'

const logger = createLogger('Todoist')

export class TodoistRequestError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

/** The resources a sync asks for (`items` are tasks). */
export type TodoistResourceType = 'items' | 'projects' | 'sections' | 'user' | 'user_plan_limits'

export interface TodoistSyncResponse {
	sync_token?: string
	full_sync?: boolean
	items?: Array<TodoistTask>
	projects?: Array<TodoistProject>
	user?: TodoistUser
	user_plan_limits?: { current?: TodoistPlanLimits }
	temp_id_mapping?: Record<string, string>
	sync_status?: Record<string, 'ok' | TodoistError>
}

interface TodoistError {
	error?: string
	error_code?: number
	http_code?: number
}

interface TodoistPage<T> {
	results?: Array<T>
	items?: Array<T>
	next_cursor?: string | null
}

/** Todoist's unified API v1 with a personal token: the account and its changes through `/sync`, old completions through REST. */
export class TodoistClient {
	/** Where the API answers; a recording test points it at its proxy. */
	static baseUrl = 'https://api.todoist.com/api/v1/'
	static readonly pageSize = 200
	private static readonly maxRetryAfterSeconds = 30

	constructor(
		private readonly token: string,
		private readonly fetchImplementation: typeof fetch = fetch,
	) { }

	/** A task as Todoist now holds it, a completed one included. */
	task(id: string) {
		return this.request<TodoistTask>('GET', `tasks/${encodeURIComponent(id)}`)
	}

	/** Tasks completed in `[since, until)`, at most three months apart (Todoist's bound). */
	completedTasks(since: Date, until: Date) {
		return this.paginate<TodoistTask>('tasks/completed/by_completion_date', { since: since.toISOString(), until: until.toISOString() })
	}

	/**
	 * Reads what changed since `syncToken` (`*` for all of it) and runs `commands` in the same request. A command
	 * Todoist refuses throws, though the request itself succeeds.
	 */
	async sync({ syncToken, resourceTypes = [], commands = [] }: { syncToken?: string, resourceTypes?: ReadonlyArray<TodoistResourceType>, commands?: ReadonlyArray<TodoistCommand> }) {
		const stamped = commands.map(command => ({ ...command, uuid: crypto.randomUUID() }))
		const response = await this.request<TodoistSyncResponse>('POST', 'sync', {
			...syncToken === undefined ? {} : { sync_token: syncToken, resource_types: resourceTypes },
			...stamped.length ? { commands: stamped } : {},
		})
		for (const command of stamped) {
			const status = response.sync_status?.[command.uuid]
			if (status !== undefined && status !== 'ok') {
				throw new TodoistRequestError(status.http_code ?? 400, `Todoist refused ${command.type}: ${status.error ?? 'no reason given'}`)
			}
		}
		return response
	}

	/** Runs `commands` in one request. @returns the ids Todoist gave the tasks their `temp_id`s named. */
	async execute(commands: ReadonlyArray<TodoistCommand>) {
		return (await this.sync({ commands })).temp_id_mapping ?? {}
	}

	private async paginate<T>(path: string, query: Record<string, string> = {}) {
		const results = new Array<T>()
		const cursors = new Set<string>()
		for (let cursor: string | undefined; ;) {
			const parameters = new URLSearchParams({ ...query, limit: String(TodoistClient.pageSize), ...cursor ? { cursor } : {} })
			const page = await this.request<TodoistPage<T>>('GET', `${path}?${parameters}`)
			results.push(...page.results ?? page.items ?? [])
			if (!page.next_cursor) {
				return results
			}
			if (cursors.has(page.next_cursor)) {
				throw new TodoistRequestError(502, `Todoist repeated a page of ${path}`)
			}
			cursors.add(cursor = page.next_cursor)
		}
	}

	private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, isRetry = false): Promise<T> {
		const response = await this.fetchImplementation(new URL(path, TodoistClient.baseUrl), {
			method,
			headers: {
				'Authorization': `Bearer ${this.token}`,
				...body === undefined ? {} : { 'Content-Type': 'application/json' },
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})

		if (response.status === 429 && !isRetry) {
			const retryAfter = Number(response.headers.get('Retry-After')) || 1
			if (retryAfter <= TodoistClient.maxRetryAfterSeconds) {
				logger.debug(`Rate limited on ${path.split('?')[0]}, retrying in ${retryAfter}s`)
				await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
				return this.request<T>(method, path, body, true)
			}
		}

		if (!response.ok) {
			// The answer alone: the request carries the token.
			const text = await response.text().catch(() => '')
			const payload = (() => { try { return JSON.parse(text) as TodoistError } catch { return undefined } })()
			throw new TodoistRequestError(response.status, `Todoist request failed (${response.status}): ${payload?.error || text.slice(0, 300) || response.statusText}`)
		}
		return await response.json() as T
	}
}
