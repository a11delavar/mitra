/** A request a server answered with an error while the client looked for the account. */
export class CalDAVRefusal {
	static async of(method: string, url: string, response: Response) {
		const reason = CalDAVRefusal.reasonIn(await response.clone().text(), response.headers.get('content-type') ?? '')
		return new CalDAVRefusal(method, url, response.status, response.statusText, reason)
	}

	/** What the body says, where a server says it: Google names the API to enable, an OAuth server why it refused the token. */
	static reasonIn(body: string, contentType: string) {
		let reason: string | undefined
		if (contentType.includes('json')) {
			try {
				const json = JSON.parse(body)
				reason = json?.error?.message ?? json?.error_description ?? json?.message ?? (typeof json?.error === 'string' ? json.error : undefined)
			} catch {
				reason = undefined
			}
		} else if (contentType.includes('html')) {
			reason = /<title>([^<]*)<\/title>/i.exec(body)?.[1]
		} else {
			reason = body.replace(/<[^>]+>/g, ' ')
		}
		reason = reason?.replace(/\s+/g, ' ').trim()
		return !reason ? undefined : reason.length > 300 ? `${reason.slice(0, 299)}…` : reason
	}

	readonly method: string
	readonly url: string
	readonly status: number
	readonly statusText: string
	readonly reason?: string

	constructor(method: string, url: string, status: number, statusText: string, reason?: string) {
		this.method = method
		this.url = url
		this.status = status
		this.statusText = statusText
		this.reason = reason
	}

	/** Discovery asks `/.well-known/caldav` first, which many servers answer with an error before it tries the address it was given. */
	get telling() {
		return !new URL(this.url).pathname.startsWith('/.well-known/')
	}

	get answer() {
		return [this.status, this.statusText].filter(Boolean).join(' ')
	}

	toString() {
		return `${this.method} ${this.url} → ${this.answer}`
	}
}

/** tsdav reports a failed account lookup as "cannot find principalUrl" or "cannot find homeUrl"; this names what the server answered. */
export class CalDAVConnectError extends Error {
	readonly status = 502

	constructor(url: string, refusals: ReadonlyArray<CalDAVRefusal>, cause: unknown) {
		const refusal = refusals.find(refusal => refusal.telling)
		super(`Could not connect to ${url}: ${refusal ? `the server answered ${refusal.answer}${refusal.reason && refusal.reason !== refusal.statusText ? `: ${refusal.reason}` : ''}` : CalDAVConnectError.messageOf(cause)}`, { cause })
	}

	/** Node's fetch fails with "fetch failed" alone, its reason (an unknown host, a refused connection) in its cause. */
	private static messageOf(error: unknown): string {
		if (!(error instanceof Error)) {
			return String(error)
		}
		return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message
	}
}
