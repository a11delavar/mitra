import { createLogger } from '#infrastructure/logging/Logger.js'
import { type TickTickProject, type TickTickProjectGroup, type TickTickTask, type TickTickTaskFields } from '../TickTick.js'

const logger = createLogger('TickTick')

export class TickTickRequestError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

interface TickTickMember {
	username?: string
	displayName?: string
	self?: boolean
}

/** TickTick's Open API with a personal token. It tells no changes: a list is read whole, its completions by when they were made. */
export class TickTickClient {
	/** Where the API answers; a recording test points it at its proxy. */
	static baseUrl = 'https://api.ticktick.com/open/v1/'
	/** The most tasks the completed list and the filter answer at once. */
	static readonly pageSize = 200
	private static readonly maxRetryAfterSeconds = 30

	constructor(
		private readonly token: string,
		private readonly fetchImplementation: typeof fetch = fetch,
	) { }

	/** The account's zone. */
	async preference() {
		return await this.request<{ timeZone?: string }>('POST', 'preference') ?? {}
	}

	async projects() {
		return await this.request<Array<TickTickProject>>('GET', 'project') ?? []
	}

	async groups() {
		return await this.request<Array<TickTickProjectGroup>>('GET', 'project/group') ?? []
	}

	/** Who the account is: the Open API names it only among a list's members. */
	async self(projectId: string) {
		const members = await this.request<Array<TickTickMember>>('GET', `project/${encodeURIComponent(projectId)}/members`) ?? []
		return members.find(member => member.self)
	}

	/** A list's open tasks, every one of them. */
	async openTasks(projectId: string) {
		return (await this.request<{ tasks?: Array<TickTickTask> }>('GET', `project/${encodeURIComponent(projectId)}/data`))?.tasks ?? []
	}

	/** Tasks of `projectId` completed in `[since, until]`, the window halved wherever it holds as many as one answer does. */
	async completedTasks(projectId: string, since: Date, until: Date): Promise<Array<TickTickTask>> {
		// With milliseconds, as no task's own date is written: a recording tells the window, which moves with every run, by them.
		const bound = (instant: Date) => instant.toISOString().replace('Z', '+0000')
		const tasks = await this.request<Array<TickTickTask>>('POST', 'task/completed', { projectIds: [projectId], startDate: bound(since), endDate: bound(until) }) ?? []
		const span = until.getTime() - since.getTime()
		if (tasks.length < TickTickClient.pageSize || span < 2000) {
			return tasks
		}
		const middle = new Date(since.getTime() + Math.floor(span / 2000) * 1000)
		const halves = [...await this.completedTasks(projectId, since, middle), ...await this.completedTasks(projectId, new Date(middle.getTime() + 1000), until)]
		return [...new Map(halves.map(task => [task.id, task])).values()]
	}

	/** Tasks of `projectId` in `statuses`; won't do (-1) is listed nowhere else. */
	async tasksIn(projectId: string, statuses: ReadonlyArray<number>) {
		return await this.request<Array<TickTickTask>>('POST', 'task/filter', { projectIds: [projectId], status: statuses }) ?? []
	}

	async task(projectId: string, id: string) {
		const task = await this.request<TickTickTask>('GET', `project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(id)}`)
		if (!task) {
			throw new TickTickRequestError(404, `TickTick has no task ${id}`)
		}
		return task
	}

	async createTask(fields: TickTickTaskFields & { projectId: string, parentId?: string }) {
		const task = await this.request<TickTickTask>('POST', 'task', fields)
		if (!task?.id) {
			throw new TickTickRequestError(502, 'TickTick did not say which task it created')
		}
		return task
	}

	/** Changes only the fields given: TickTick keeps what a write leaves out. */
	async updateTask(id: string, projectId: string, fields: TickTickTaskFields & { status?: number, parentId?: string }) {
		await this.request('POST', `task/${encodeURIComponent(id)}`, { id, projectId, ...fields })
	}

	/** Completes a task as TickTick's apps do: a repeating one moves on to its next date, open, and its completion is kept apart. */
	async completeTask(projectId: string, id: string) {
		await this.request('POST', `project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(id)}/complete`)
	}

	async moveTask(id: string, fromProjectId: string, toProjectId: string) {
		await this.request('POST', 'task/move', [{ fromProjectId, toProjectId, taskId: id }])
	}

	async deleteTask(projectId: string, id: string) {
		await this.request('DELETE', `project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(id)}`)
	}

	private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown, isRetry = false): Promise<T | undefined> {
		const response = await this.fetchImplementation(new URL(path, TickTickClient.baseUrl), {
			method,
			headers: {
				'Authorization': `Bearer ${this.token}`,
				...body === undefined ? {} : { 'Content-Type': 'application/json' },
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})

		if (response.status === 429 && !isRetry) {
			const retryAfter = Number(response.headers.get('Retry-After')) || 1
			if (retryAfter <= TickTickClient.maxRetryAfterSeconds) {
				logger.debug(`Rate limited on ${path}, retrying in ${retryAfter}s`)
				await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
				return this.request<T>(method, path, body, true)
			}
		}

		// The answer alone: the request carries the token.
		const text = await response.text().catch(() => '')
		if (!response.ok) {
			const payload = (() => { try { return JSON.parse(text) as { errorMessage?: string } } catch { return undefined } })()
			throw new TickTickRequestError(response.status, `TickTick request failed (${response.status}): ${payload?.errorMessage || text.slice(0, 300) || response.statusText}`)
		}
		// Completing, moving or deleting answers nothing.
		return text ? JSON.parse(text) as T : undefined
	}
}
