import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import express from 'express'
import { Api } from '@a11d/api'
import '@3mo/date-time-value-constructor'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { User } from '../../features/identity/User.js'
import { Source } from '../../features/sources/Source.js'
import { Entry } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { staleTabs } from '../../features/entries/server/staleTabs.js'
import { MitraCalendar } from '../../integrations/mitra/MitraCalendar.js'
import '../../integrations/server/registerEngines.js'
import { errorHandler } from '../http/errorHandler.js'

/**
 * The operations' routes as the app mounts them, refusals answered as the app answers them, which a test calls through
 * the browser's API client: one user with one Mitra integration holding one calendar, in a database in memory. The test
 * process is the browser and the server at once, so while a request is handled the server's days are in force: as
 * stored, read in no zone. `node --test` runs each test file in a process of its own, so each starts one.
 */
export class OperationServer {
	static async start() {
		// After the test file has loaded: the database opens on import.
		const { orm } = await import('../database/orm.js')
		const { operationsRouter } = await import('./Operation.js')
		await import('../../app/operations.js')

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
			const viewer = Entry.dayZone
			Entry.dayZone = () => undefined
			const end = res.end.bind(res) as (...parameters: Array<unknown>) => typeof res
			res.end = ((...parameters: Array<unknown>) => {
				Entry.dayZone = viewer
				return end(...parameters)
			}) as typeof res.end
			next()
		})
		app.use(express.json({ reviver: (_key, value) => models.shallConstruct(value) ? models.construct(value) : value }))
		app.use('/api/entries', staleTabs)
		app.use('/api/sources', express.text({ type: 'text/calendar', limit: '25mb' }))
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

	async close() {
		await new Promise(resolve => this.server.close(resolve))
		await this.closeOrm()
	}
}
