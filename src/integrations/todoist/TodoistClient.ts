export interface TodoistProject {
	id: string
	name: string
	is_archived?: boolean
	is_deleted?: boolean
}

export interface TodoistDue {
	date: string
	datetime?: string | null
	timezone?: string | null
	is_recurring?: boolean
	lang?: string
	string?: string
}

export interface TodoistDeadline {
	date: string
}

export interface TodoistDuration {
	amount: number
	unit: 'minute' | 'day'
}

export interface TodoistTask {
	id: string
	project_id: string
	content: string
	description?: string
	checked?: boolean
	is_deleted?: boolean
	due?: TodoistDue | null
	deadline?: TodoistDeadline | null
	duration?: TodoistDuration | null
	url?: string
}

export interface TodoistTaskInput {
	due?: TodoistDue | null
	content?: string
	description?: string
	project_id?: string
	due_date?: string | null
	due_datetime?: string | null
	due_string?: string
	deadline_date?: string | null
	deadline_lang?: string
	duration?: number | null
	duration_unit?: 'minute' | 'day'
}

export class TodoistRequestError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
		this.name = 'TodoistRequestError'
	}
}

interface CursorPage<T> {
	results?: Array<T>
	items?: Array<T>
	next_cursor?: string | null
}

/** Small, typed wrapper around Todoist's current REST API v1. */
export class TodoistClient {
	static readonly baseUrl = 'https://api.todoist.com/api/v1'

	constructor(private readonly token: string, private readonly fetcher: typeof fetch = fetch) { }

	user(): Promise<{ tz_info: { timezone: string } }> {
		return this.request('user')
	}

	projects(): Promise<Array<TodoistProject>> {
		return this.allPages<TodoistProject>('projects', 'results')
	}

	tasks(projectId: string): Promise<Array<TodoistTask>> {
		const query = new URLSearchParams({ project_id: projectId })
		return this.allPages<TodoistTask>(`tasks?${query}`, 'results')
	}

	completedTasks(projectId: string, since: string, until: string): Promise<Array<TodoistTask>> {
		const query = new URLSearchParams({ since, until, project_id: projectId })
		return this.allPages<TodoistTask>(`tasks/completed/by_completion_date?${query}`, 'items')
	}

	createTask(input: TodoistTaskInput): Promise<TodoistTask> {
		return this.request<TodoistTask>('tasks', { method: 'POST', body: JSON.stringify(input) })
	}

	task(id: string): Promise<TodoistTask> {
		return this.request<TodoistTask>(`tasks/${encodeURIComponent(id)}`)
	}

	async updateTask(id: string, input: TodoistTaskInput): Promise<TodoistTask> {
		const { due, ...fields } = input
		const updated = await this.request<TodoistTask>(`tasks/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(fields) })
		if (due === undefined) {
			return updated
		}
		const uuid = crypto.randomUUID()
		const result = await this.request<{ sync_status: Record<string, 'ok' | { error: string, http_code?: number }> }>('sync', {
			method: 'POST',
			body: JSON.stringify({ commands: [{ type: 'item_update', uuid, args: { id, due } }] }),
		})
		const status = result.sync_status?.[uuid]
		if (status !== 'ok') {
			throw new TodoistRequestError(typeof status === 'object' ? status.http_code ?? 502 : 502, typeof status === 'object' ? status.error : 'Todoist did not confirm the schedule update')
		}
		return this.task(id)
	}

	closeTask(id: string): Promise<void> {
		return this.request<void>(`tasks/${encodeURIComponent(id)}/close`, { method: 'POST' })
	}

	reopenTask(id: string): Promise<void> {
		return this.request<void>(`tasks/${encodeURIComponent(id)}/reopen`, { method: 'POST' })
	}

	deleteTask(id: string): Promise<void> {
		return this.request<void>(`tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
	}

	private async allPages<T>(path: string, collection: 'results' | 'items'): Promise<Array<T>> {
		const separator = path.includes('?') ? '&' : '?'
		let nextPath = `${path}${separator}limit=200`
		const items: Array<T> = []
		const cursors = new Set<string>()
		while (nextPath) {
			const page = await this.request<CursorPage<T>>(nextPath)
			items.push(...(page[collection] ?? []))
			const cursor = page.next_cursor
			if (!cursor) {
				break
			}
			if (cursors.has(cursor)) {
				throw new TodoistRequestError(502, 'Todoist returned a repeated pagination cursor')
			}
			cursors.add(cursor)
			nextPath = `${path}${separator}limit=200&cursor=${encodeURIComponent(cursor)}`
		}
		return items
	}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const headers = new Headers(init.headers)
		headers.set('Authorization', `Bearer ${this.token}`)
		if (init.body !== undefined) {
			headers.set('Content-Type', 'application/json')
		}
		const response = await this.fetcher(`${TodoistClient.baseUrl}/${path}`, { ...init, headers })
		if (!response.ok) {
			// Do not include request headers or body: either could contain the user's API token.
			const detail = (await response.text()).slice(0, 500)
			throw new TodoistRequestError(response.status, `Todoist API returned ${response.status}${detail ? `: ${detail}` : ''}`)
		}
		if (response.status === 204) {
			return undefined as T
		}
		return await response.json() as T
	}
}
