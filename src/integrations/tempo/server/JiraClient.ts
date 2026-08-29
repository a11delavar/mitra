import { type TempoIssue } from '../Tempo.js'

export class JiraRequestError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

/**
 * Minimal Jira Cloud REST API client for resolving user profile details, issue metadata, and project keys.
 */
export class JiraClient {
	static readonly bulkFetchLimit = 100

	constructor(
		private readonly siteUrl: string,
		email: string,
		token: string,
		private readonly fetchImplementation: typeof fetch = fetch,
	) {
		this.authorization = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
	}

	private readonly authorization: string

	private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
		const response = await this.fetchImplementation(new URL(path, `${this.siteUrl.replace(/\/+$/, '')}/`), {
			method,
			headers: {
				'Authorization': this.authorization,
				'Accept': 'application/json',
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})
		if (!response.ok) {
			const payload = await response.json().catch(() => undefined) as { errorMessages?: Array<string> } | undefined
			throw new JiraRequestError(response.status, `Jira request failed (${response.status}): ${payload?.errorMessages?.join('; ') || response.statusText}`)
		}
		return await response.json() as T
	}

	/** Returns authenticated Jira user profile details including accountId and timeZone. */
	myself(): Promise<{ accountId: string, displayName?: string, emailAddress?: string, timeZone?: string }> {
		return this.request('GET', 'rest/api/3/myself')
	}

	/** Fetches issue summaries and keys keyed by both numeric id and issue key. */
	async issues(idsOrKeys: Array<string>): Promise<Map<string, TempoIssue & { id: string }>> {
		const resolved = new Map<string, TempoIssue & { id: string }>()
		for (let index = 0; index < idsOrKeys.length; index += JiraClient.bulkFetchLimit) {
			const batch = idsOrKeys.slice(index, index + JiraClient.bulkFetchLimit)
			const response = await this.request<{ issues?: Array<{ id: string, key: string, fields?: { summary?: string } }> }>('POST', 'rest/api/3/issue/bulkfetch', {
				issueIdsOrKeys: batch,
				fields: ['summary'],
			})
			for (const issue of response.issues ?? []) {
				const entry = { id: issue.id, key: issue.key, summary: issue.fields?.summary ?? '' }
				resolved.set(issue.id, entry)
				resolved.set(issue.key, entry)
			}
		}
		return resolved
	}

	/** Fetches visible Jira project keys. */
	async projectKeys(): Promise<Array<string>> {
		const keys: Array<string> = []
		for (let startAt = 0; ; startAt += 50) {
			const page = await this.request<{ values?: Array<{ key: string }>, isLast?: boolean }>('GET', `rest/api/3/project/search?startAt=${startAt}&maxResults=50`)
			keys.push(...(page.values ?? []).map(project => project.key))
			if (page.isLast !== false || !page.values?.length) {
				return keys
			}
		}
	}
}
