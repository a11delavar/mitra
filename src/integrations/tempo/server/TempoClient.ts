import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { type TempoWorklog } from '../Tempo.js'

const logger = createLogger('Tempo')

export class TempoRequestError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

/** What a worklog write carries. `issueId` is absent from the update shape because Tempo's PUT has no
 * such field at all: a worklog cannot be moved to another issue, only deleted and booked again. */
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

/** One entry of the audit feed that reports worklogs deleted since a timestamp. */
export interface TempoDeletedWorklog {
	tempoWorklogId: string
	deletedAt: string
}

/**
 * The Tempo REST API v4 (api.tempo.io), bearer-authenticated — the counterpart of NotionClient, and
 * server-only for the same reason: the token must never ride to a browser.
 *
 * The universal host is deliberate over the regional ones (api.eu/api.us): a token belonging to
 * another cluster is answered with a plain 401 there, while the universal host routes either way.
 */
export class TempoClient {
	static readonly baseUrl = 'https://api.tempo.io/'

	/** Tempo asks for ~1s between requests; a 429 carries Retry-After. Anything longer than this fails
	 * the cycle rather than stalling the single-threaded synchronizer loop (NotionClient's rule). */
	private static readonly maxRetryAfterSeconds = 30

	/** The API's own ceiling — a page of 1000 makes even a first full import a handful of requests. */
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
			// Tempo answers errors as `{ errors: [{ message }] }`, and occasionally as bare text.
			const payload = await response.json().catch(() => undefined) as { errors?: Array<{ message?: string }> } | undefined
			const message = payload?.errors?.map(error => error.message).filter(Boolean).join('; ')
			throw new TempoRequestError(response.status, `Tempo request failed (${response.status}): ${message || response.statusText}`)
		}
		return response.status === 204 ? undefined as T : await response.json() as T
	}

	/** Drain an offset-paginated listing. Tempo reports a `metadata.next` URL while more remain. */
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

	/** The instance's configuration — the cheapest "is this token valid" probe, and the source of the
	 * booking rules a write can violate (how far into the future, whether start times are kept). */
	globalConfiguration(): Promise<{ numberOfDaysAllowedIntoFuture?: number, startAndEndTimesEnabled?: boolean }> {
		return this.request('GET', '4/globalconfiguration')
	}

	/** One author's worklogs, optionally only those modified since `updatedFrom` (a date or datetime) —
	 * which is what makes the steady-state sync a single small request. */
	searchWorklogs(authorAccountId: string, updatedFrom?: string): Promise<Array<TempoWorklog>> {
		return this.paginate(offset => this.request('POST', `4/worklogs/search?limit=${TempoClient.pageSize}&offset=${offset}`, {
			authorIds: [authorAccountId],
			...(updatedFrom ? { updatedFrom } : {}),
		}))
	}

	/**
	 * The worklogs deleted since `updatedFrom`, from Tempo's audit feed. Deletions are invisible to the
	 * ordinary listing — a deleted worklog is simply absent — and this feed is what spares the sync
	 * from fetching every worklog ever just to diff the set. Requires a full ISO datetime; a bare date
	 * is rejected.
	 */
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
