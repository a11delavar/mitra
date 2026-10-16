import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/*
	Test support, never production code: what a real server answered, recorded once on a developer's machine and replayed
	everywhere else, so a test meets that server's real answers without needing one. A test runs the same steps in both modes:

	- record: a proxy in front of the real server passes every request through and writes each exchange to the recording;
	- replay: a server answers each request with the recorded answer to the same request, and notes any request the real
	  server never saw, which the test fails on, as a sign the code now asks something else and the recording is due again.

	What differs between runs is replaced by placeholders before an exchange is stored or compared: the values a test names
	(the server's address, its account), the times a client stamps on what it writes, and what either side mints. Minted
	values are numbered in the order the traffic first names them, and the file keeps what each was: ids, which the client
	mints anew in every run, and the server's tokens (ETags, sync tokens) and times, which replay hands back as recorded.
	Exchanges are kept by request, each request's answers in the order they came, as a client sends some at once and they
	land in either order. So a recording made again changes in those lists, while its exchanges change only where the
	traffic does.
*/

type Minted = 'id' | 'token' | 'time'

/** What a recording file holds: the version of the server that answered, what each minted value was, and the exchanges in the order they ran. */
interface HttpRecordingFile {
	readonly version?: string
	readonly minted: Readonly<Record<Minted, ReadonlyArray<string>>>
	readonly exchanges: ReadonlyArray<HttpExchange>
}

/** One request and its answer, with placeholders for what differs between runs. */
export interface HttpExchange {
	readonly request: { readonly method: string, readonly path: string, readonly headers: Readonly<Record<string, string>>, readonly body: string }
	readonly response: { readonly status: number, readonly headers: Readonly<Record<string, string>>, readonly body: string }
}

/** Request headers that change what a server answers; the rest (authorization, user agent, lengths) are left out. */
const requestHeaders = ['content-type', 'depth', 'if-match', 'if-none-match', 'prefer', 'brief']
/** Response headers a client reads. */
const responseHeaders = ['content-type', 'etag', 'location', 'dav', 'allow', 'last-modified']
/** Headers holding a token the server minted, which a client hands back. */
const tokenHeaders = ['etag', 'if-match', 'if-none-match']
const uuids = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
/** iCalendar lines stamped with the time they were written. */
const timestamps = /^(DTSTAMP|LAST-MODIFIED|CREATED)((?:;[^:\r\n]*)?:)(.*)$/gm
/** WebDAV properties holding a server's token, quoted or not, or the time a resource last changed. */
const tokenProperties = /(<((?:\w+:)?(?:getetag|sync-token|getctag))>(?:W\/)?(?:"|&quot;)?)([^<"&]+)((?:"|&quot;)?<\/\2>)/g
const timeProperties = /(<((?:\w+:)?getlastmodified)>)([^<]+)(<\/\2>)/g
/** A token header's value, `"…"` or `W/"…"`; `*` names none. */
const tokenValue = /^((?:W\/)?"?)([^"*]+)("?)$/

const readBody = (message: IncomingMessage) => new Promise<string>((resolve, reject) => {
	const chunks: Array<Buffer> = []
	message.on('data', chunk => chunks.push(chunk as Buffer))
	message.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
	message.on('error', reject)
})

const listen = (server: Server) => new Promise<string>(resolve => server.listen(0, () => resolve(`http://localhost:${(server.address() as AddressInfo).port}`)))

export class HttpRecording {
	/**
	 * `values` maps a placeholder to what it stands for in this run (the server's address, an account), read whenever an exchange is
	 * stored or matched, so a value known only once the test runs (an app's port) can join late.
	 */
	constructor(readonly file: string, private readonly values: () => Readonly<Record<string, string>>) { }

	/** This run's minted values by their number; replay starts from the server's as recorded, while the client mints its ids anew. */
	private readonly minted: Record<Minted, Array<string>> = { id: [], token: [], time: [] }
	private recordedIds: ReadonlyArray<string> = []

	/** Whether there is a recording to replay. */
	get exists() {
		return existsSync(this.file)
	}

	/** The version of the server the recording was made from, where the recording names it. */
	get version() {
		return this.exists ? this.read().version : undefined
	}

	private read() {
		return JSON.parse(readFileSync(this.file, 'utf8')) as HttpRecordingFile
	}

	/** A token is found by its value, as a client hands it back; a time never comes back, so each gets its own number, whichever second it fell in. */
	private placeholderOf(kind: Minted, value: string) {
		const known = kind === 'time' ? -1 : this.minted[kind].indexOf(value)
		return `{${kind}:${known >= 0 ? known : this.minted[kind].push(value) - 1}}`
	}

	/** Unfolded first: iCalendar folds lines at 75 octets, which may split a value, and where depends on how long the values are. */
	private toPlaceholders(text: string) {
		let result = text.replace(/\r?\n[ \t]/g, '')
		for (const [placeholder, value] of Object.entries(this.values()).sort(([, a], [, b]) => b.length - a.length)) {
			if (value) {
				result = result.replaceAll(value, `{${placeholder}}`)
			}
		}
		return result
			.replace(uuids, id => this.placeholderOf('id', id))
			.replace(tokenProperties, (_, open: string, _name: string, token: string, close: string) => `${open}${this.placeholderOf('token', token)}${close}`)
			.replace(timeProperties, (_, open: string, _name: string, time: string, close: string) => `${open}${this.placeholderOf('time', time)}${close}`)
	}

	private headerToPlaceholders(name: string, value: string) {
		if (tokenHeaders.includes(name)) {
			return value.replace(tokenValue, (_, open: string, token: string, close: string) => `${open}${this.placeholderOf('token', token)}${close}`)
		}
		return name === 'last-modified' ? this.placeholderOf('time', value) : this.toPlaceholders(value)
	}

	private fromPlaceholders(text: string) {
		let result = text.replace(/\{(id|token|time):(\d+)\}/g, (_, kind: Minted, number: string) => kind === 'id'
			? this.minted.id[Number(number)] ??= this.recordedIds[Number(number)] ?? crypto.randomUUID()
			: this.minted[kind][Number(number)]!)
		for (const [placeholder, value] of Object.entries(this.values())) {
			result = result.replaceAll(`{${placeholder}}`, value)
		}
		return result
	}

	/** A client stamps what it writes with the time of writing, which is never the recording's: `{now}` matches any. */
	private requestOf(message: IncomingMessage, body: string) {
		const headers = Object.fromEntries(requestHeaders.filter(name => message.headers[name] !== undefined).map(name => [name, this.headerToPlaceholders(name, String(message.headers[name]))]))
		return {
			method: message.method ?? 'GET',
			path: this.toPlaceholders(message.url ?? '/'),
			headers,
			body: this.toPlaceholders(body.replace(timestamps, '$1$2{now}')),
		}
	}

	/** The server's answer as recorded: the times it stamped become its own, numbered. */
	private responseOf(status: number, headers: Record<string, string>, body: string) {
		return {
			status,
			headers: Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, this.headerToPlaceholders(name, value)])),
			body: this.toPlaceholders(body.replace(/\r?\n[ \t]/g, '').replace(timestamps, (_, name: string, separator: string, time: string) => `${name}${separator}${this.placeholderOf('time', time)}`)),
		}
	}

	/** Sorted by request, the order replay matches by; the server's tokens and times are then numbered as the file names them. */
	private fileOf(version: string | undefined, exchanges: ReadonlyArray<HttpExchange>): HttpRecordingFile {
		const sorted = [...exchanges].sort((a, b) => `${a.request.path} ${a.request.method}`.localeCompare(`${b.request.path} ${b.request.method}`))
		const minted = { id: this.minted.id, token: new Array<string>(), time: new Array<string>() }
		const numbers = { token: new Map<number, number>(), time: new Map<number, number>() }
		const renumbered = JSON.stringify(sorted).replace(/\{(token|time):(\d+)\}/g, (_, kind: 'token' | 'time', number: string) => {
			if (!numbers[kind].has(Number(number))) {
				numbers[kind].set(Number(number), minted[kind].push(this.minted[kind][Number(number)]!) - 1)
			}
			return `{${kind}:${numbers[kind].get(Number(number))}}`
		})
		return { version, minted, exchanges: JSON.parse(renumbered) as Array<HttpExchange> }
	}

	/** Proxies to `target`, the real server, recording every exchange; `close()` writes the recording, naming the server's `version`. */
	async record(target: string, version?: string) {
		const exchanges = new Array<HttpExchange>()
		const server = createServer(async (incoming, outgoing) => {
			const raw = await readBody(incoming)
			const request = this.requestOf(incoming, raw)
			const forwarded = Object.fromEntries(Object.entries(incoming.headers).filter(([name]) => !['host', 'content-length', 'connection'].includes(name)).map(([name, value]) => [name, String(value)]))
			// The client follows a redirect itself, so it is recorded as the server sent it.
			const answer = await fetch(`${target}${incoming.url}`, { method: incoming.method, headers: forwarded, body: ['GET', 'HEAD'].includes(incoming.method ?? 'GET') ? undefined : raw, redirect: 'manual' })
			// The client meets only the proxy, so an address the server names (a redirect, a link in a body) leads back through it.
			const body = (await answer.text()).replaceAll(target, origin)
			const headers = Object.fromEntries(responseHeaders.filter(name => answer.headers.has(name)).map(name => [name, answer.headers.get(name)!.replaceAll(target, origin)]))
			exchanges.push({ request, response: this.responseOf(answer.status, headers, body) })
			outgoing.writeHead(answer.status, headers).end(body)
		})
		const origin = await listen(server)
		return {
			origin,
			close: async () => {
				await new Promise(resolve => server.close(resolve))
				writeFileSync(this.file, JSON.stringify(this.fileOf(version, exchanges), null, '\t') + '\n')
			},
		}
	}

	/** Answers from the recording: each request takes the first unused exchange recorded for the same request. */
	async replay() {
		const recording = this.read()
		this.minted.token.push(...recording.minted.token)
		this.minted.time.push(...recording.minted.time)
		this.recordedIds = recording.minted.id
		const exchanges = recording.exchanges.map(exchange => ({ exchange, used: false }))
		const unrecorded = new Array<string>()
		const server = createServer(async (incoming, outgoing) => {
			const request = this.requestOf(incoming, await readBody(incoming))
			const match = exchanges.find(({ exchange, used }) => !used
				&& exchange.request.method === request.method
				&& exchange.request.path === request.path
				&& exchange.request.body === request.body
				&& requestHeaders.every(name => exchange.request.headers[name] === request.headers[name]))
			if (!match) {
				unrecorded.push(`${request.method} ${request.path}${request.body ? `\n${request.body}` : ''}`)
				outgoing.writeHead(599, { 'content-type': 'text/plain' }).end('Not in the recording')
				return
			}
			match.used = true
			const { status, headers, body } = match.exchange.response
			outgoing.writeHead(status, Object.fromEntries(Object.entries(headers).map(([name, value]) => [name, this.fromPlaceholders(value)]))).end(this.fromPlaceholders(body))
		})
		const origin = await listen(server)
		return {
			origin,
			/** The requests the real server never saw: a non-empty list means the recording is due again. */
			unrecorded,
			/** The recorded exchanges nothing asked for again: the code no longer does something it did. */
			get unasked() {
				return exchanges.filter(({ used }) => !used).map(({ exchange }) => `${exchange.request.method} ${exchange.request.path}`)
			},
			close: () => new Promise<void>(resolve => server.close(() => resolve())),
		}
	}
}
