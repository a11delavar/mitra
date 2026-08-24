import { type TempoIssue } from '../Tempo.js'

export class JiraRequestError extends Error {
	constructor(readonly status: number, message: string) {
		super(message)
	}
}

/**
 * The slice of the Jira Cloud REST API the Tempo integration needs, and only that: who the credential
 * is, what an issue is called, and which project keys exist.
 *
 * Separate from {@link TempoClient} because it is a different product behind a different host, a
 * different auth scheme (Basic `email:token`, not a bearer) and a different failure domain — a Jira
 * outage degrades headings to `#id` while the timesheet itself keeps syncing.
 */
export class JiraClient {
	/** Jira caps a bulk fetch at 100 ids per request. */
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

	/** The account the credential authenticates as — the `authorAccountId` every Tempo write needs, and
	 * the integration's display label. Tempo v4 has no equivalent endpoint of its own. */
	myself(): Promise<{ accountId: string, displayName?: string, emailAddress?: string, timeZone?: string }> {
		return this.request('GET', 'rest/api/3/myself')
	}

	/** Names for issues addressed by numeric id or by key — both forms in one call, which is what lets
	 * the same request serve a sync (id → key) and a create (key → id). Issues the credential cannot
	 * see come back in `errors` rather than as a failure, so a partly-visible batch still resolves. */
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
				// Keyed under BOTH forms: the caller asked in one of them and shouldn't have to know which.
				resolved.set(issue.id, entry)
				resolved.set(issue.key, entry)
			}
		}
		return resolved
	}

	/** Every project key the credential can see — what tells a real issue key apart from any other
	 * hyphenated word in an entry's title (see Tempo.findIssueKey). */
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
