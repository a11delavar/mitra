import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { type TempoWorklog } from '../Tempo.js'

const logger = createLogger('Tempo')

export class TempoRequestError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

export interface TempoWorklogInput {
	authorAccountId: string
	startDate: string
	startTime?: string
	timeSpentSeconds: number
	description?: string
	billableSeconds?: number
	attributes?: Array<{ key: string, value: unknown }>
}

interface TempoList<T> {
	results: Array<T>
	metadata?: { next?: string }
}

export interface TempoDeletedWorklog {
	tempoWorklogId: string
	deletedAt: string
}

/**
 * REST API client for Tempo Timesheets v4 (api.tempo.io) using Bearer token authentication.
 */
export class TempoClient {
	static readonly baseUrl = 'https://api.tempo.io/'
	private static readonly maxRetryAfterSeconds = 30
	static readonly pageSize = 1000

	constructor(
		private readonly token: string,
		private readonly fetchImplementation: typeof fetch = fetch,
	) { }

	private async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, isRetry = false): Promise<T> {
		const response = await this.fetchImplementation(new URL(path, TempoClient.baseUrl), {
			method,
			headers: {
				'Authorization': `Bearer ${this.token}`,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})

		if (response.status === 429 && !isRetry) {
			const retryAfter = Number(response.headers.get('Retry-After')) || 1
			if (retryAfter <= TempoClient.maxRetryAfterSeconds) {
				logger.debug(`Rate limited on ${path} — retrying in ${retryAfter}s`)
				await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
				return this.request<T>(method, path, body, true)
			}
		}

		if (!response.ok) {
			const payload = await response.json().catch(() => undefined) as { errors?: Array<{ message?: string }> } | undefined
			const message = payload?.errors?.map(error => error.message).filter(Boolean).join('; ')
			throw new TempoRequestError(response.status, `Tempo request failed (${response.status}): ${message || response.statusText}`)
		}
		return response.status === 204 ? undefined as T : await response.json() as T
	}

	private async paginate<T>(page: (offset: number) => Promise<TempoList<T>>): Promise<Array<T>> {
		const results: Array<T> = []
		for (let offset = 0; ; offset += TempoClient.pageSize) {
			const list = await page(offset)
			results.push(...list.results)
			if (!list.metadata?.next || !list.results.length) {
				return results
			}
		}
	}

	/** Returns global configuration for the Tempo instance. */
	globalConfiguration(): Promise<{ numberOfDaysAllowedIntoFuture?: number, startAndEndTimesEnabled?: boolean }> {
		return this.request('GET', '4/globalconfiguration')
	}

	/** Searches worklogs for a given author, optionally filtered by update date/time. */
	searchWorklogs(authorAccountId: string, updatedFrom?: string): Promise<Array<TempoWorklog>> {
		return this.paginate(offset => this.request('POST', `4/worklogs/search?limit=${TempoClient.pageSize}&offset=${offset}`, {
			authorIds: [authorAccountId],
			...(updatedFrom ? { updatedFrom } : {}),
		}))
	}

	/** Fetches worklog deletions from the Tempo audit log since an ISO datetime. */
	async deletedWorklogs(updatedFrom: string): Promise<Array<TempoDeletedWorklog>> {
		const list = await this.request<TempoList<TempoDeletedWorklog>>('GET', `papertrail/1/events/deleted/types/worklog?updatedFrom=${encodeURIComponent(updatedFrom)}&limit=${TempoClient.pageSize}`)
		return list.results
	}

	createWorklog(input: TempoWorklogInput & { issueId: number }): Promise<TempoWorklog> {
		return this.request('POST', '4/worklogs', input)
	}

	updateWorklog(worklogId: string, input: TempoWorklogInput): Promise<TempoWorklog> {
		return this.request('PUT', `4/worklogs/${worklogId}`, input)
	}

	deleteWorklog(worklogId: string): Promise<void> {
		return this.request('DELETE', `4/worklogs/${worklogId}`)
	}
}
