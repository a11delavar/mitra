import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import express from 'express'
import { Api } from '@a11d/api'
import '@3mo/date-time-value-constructor'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { User } from '#features/identity'
import { Source } from '#features/sources'
import { EntryType } from '#features/entries'
import { staleTabs } from '#features/entries/server/staleTabs.js'
import { holdLocalIn } from '#features/time/TimeZone.testing.js'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import '#integrations/server/registerEngines.js'
import { errorHandler } from '#infrastructure/http/errorHandler.js'
// The browser's client, whose error an operation's call throws.
import '#infrastructure/http/Api.js'

/** An entry as the API sends it, as the tests read one: dates as UTC instants, its rule as an object. */
export interface SentEntry {
	readonly id: string
	readonly sourceId: string
	readonly heading?: string
	readonly start?: string
	readonly end?: string
	readonly due?: string
	readonly allDay?: boolean
	readonly status?: string
	readonly occurrence?: string
	readonly recurrence?: string
	readonly description?: string
	readonly location?: string
}

/** What a tool call answers: its text, its data, and whether it refused. */
export interface ToolCall {
	readonly isError?: boolean
	readonly content: Array<{ readonly type: string, readonly text: string }>
	readonly structuredContent?: Record<string, unknown>
}

/**
 * The operations' routes as the app mounts them, refusals answered as the app answers them, which a test calls through
 * the browser's API client: one user with one Mitra integration holding one calendar, in a database in memory. The test
 * process is the browser and the server at once, so while a request is handled the server's days are in force: as
 * stored, read in no zone. `node --test` runs each test file in a process of its own, so each starts one.
 */
export class OperationServer {
	static async start() {
		// After the test file has loaded: the database opens on import.
		const { orm } = await import('#infrastructure/database/orm.js')
		const { operationsRouter } = await import('./server/operationsRouter.js')
		const { mcpRouter } = await import('#features/agents/server/mcp.js')
		const { accessTokenMiddleware } = await import('#features/identity/server/accessTokenMiddleware.js')
		await import('#app/operations.js')

		const em = orm.em.fork()
		const user = new User({ username: 'account-owner' })
		const integration = new MitraCalendar({ userId: user.id, uri: MitraCalendar.uri })
		const source = new Source({ integrationId: integration.id, uri: MitraCalendar.sourceUri('home'), name: 'Home', entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false })
		em.persist([user, integration, source])
		await em.flush()

		const models = new ModelValueConstructor()
		const app = express()
		app.use((req, res, next) => {
			req.user = user
			// From parsing the body on, this is the server; the viewer is back once the response is out.
			const restoreViewer = holdLocalIn(undefined)
			const end = res.end.bind(res) as (...parameters: Array<unknown>) => typeof res
			res.end = ((...parameters: Array<unknown>) => {
				restoreViewer()
				return end(...parameters)
			}) as typeof res.end
			next()
		})
		app.use(express.json({ reviver: (_key, value) => models.shallConstruct(value) ? models.construct(value) : value }))
		app.use('/api/entries', staleTabs)
		app.use('/api/sources', express.text({ type: 'text/calendar', limit: '25mb' }))
		app.use('/api/mcp', accessTokenMiddleware, mcpRouter)
		app.use('/api', operationsRouter(() => orm.em.fork()))
		app.use(errorHandler)
		const server = await new Promise<Server>(resolve => {
			const listening = app.listen(0, () => resolve(listening))
		})
		Api.url = `http://localhost:${(server.address() as AddressInfo).port}/api`
		// @a11d/api sets `referrer: 'no-referrer'`, which a browser resolves against the page and Node's fetch refuses.
		const browserFetch = globalThis.fetch
		globalThis.fetch = (input, init) => browserFetch(input, { ...init, referrer: undefined })
		const connection = orm.em.getConnection()
		return new OperationServer(server, user, integration, source, (sql, parameters) => connection.execute(sql, parameters), () => orm.close())
	}

	private constructor(
		private readonly server: Server,
		readonly user: User,
		readonly integration: MitraCalendar,
		readonly source: Source,
		private readonly execute: (sql: string, parameters: Array<unknown>) => Promise<Array<unknown>>,
		private readonly closeOrm: () => Promise<void>,
	) { }

	/** Where the API answers, for a test sending what the API client would not. */
	get url() {
		return Api.url
	}

	/** Rows as stored, for a test asserting what the database holds rather than what the API answers. */
	async query<Row>(sql: string, parameters: Array<unknown> = []): Promise<Array<Row>> {
		return await this.execute(sql, parameters) as Array<Row>
	}

	private agent?: Client

	/** Calls a tool as an agent does, through the MCP SDK's own client on the same server. */
	async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCall> {
		if (!this.agent) {
			this.agent = new Client({ name: 'test-agent', version: '1.0.0' })
			await this.agent.connect(new StreamableHTTPClientTransport(new URL(`${Api.url}/mcp`)))
		}
		return await this.agent.callTool({ name, arguments: args }) as ToolCall
	}

	/** A tool's data where it answered, or what it refused as an error the test reads. */
	async tool<Data = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<Data> {
		const call = await this.callTool(name, args)
		if (call.isError) {
			throw new Error(call.content[0]?.text)
		}
		return call.structuredContent as Data
	}

	async close() {
		await this.agent?.close()
		await new Promise(resolve => this.server.close(resolve))
		await this.closeOrm()
	}
}
