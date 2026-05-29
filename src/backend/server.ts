import express, { type ErrorRequestHandler } from 'express'
import { EventEmitter } from 'node:events'
import path from 'path'
import cors from 'cors'
import dotenv from 'dotenv'
import { MikroORM, UnderscoreNamingStrategy, NotFoundError } from '@mikro-orm/sqlite'
import { User, Integration, CalDAV, Source, Entry, createLogger } from '../shared/index.js'
import { Synchronizer } from './Synchronizer.js'

dotenv.config({ path: `${import.meta.dirname}/.env` })

const logger = createLogger('API')

export const orm = await MikroORM.init({
	entities: [User, Integration, CalDAV, Source, Entry],
	dbName: `${import.meta.dirname}/../../data/database.sqlite`,
	/**
	 * Standard snake_case naming, but without the redundant `_id` suffix that
	 * `mapToPk` relations would otherwise add. Our FK properties already end in
	 * `Id` (`sourceId`, `integrationId`, `userId`), so the column is simply the
	 * underscored property name (`source_id`) — consistent with every other column
	 * (`external_id`, `raw_data`) instead of the default doubled `source_id_id`.
	 */
	namingStrategy: class extends UnderscoreNamingStrategy {
		override joinColumnName(propertyName: string) {
			return this.propertyToColumnName(propertyName)
		}

		override joinKeyColumnName(entityName: string) {
			return this.propertyToColumnName(entityName)
		}
	},
	allowGlobalContext: true,
})
await orm.schema.update()

const app = express()
app.use(cors())
app.use(express.json())

let defaultUser = await orm.em.findOne(User, { username: User.default.username })
if (!defaultUser) {
	defaultUser = User.default
	orm.em.persist(defaultUser)
	await orm.em.flush()
}

// Global Auth Middleware
app.use((req, _res, next) => {
	// In the future, this is where we check the Bearer token for OIDC
	// For now, we run in zero-auth single-user mode
	(req as any).user = defaultUser
	next()
})

const PORT = 3000

export const syncEmitter = new EventEmitter()
new Synchronizer(orm).start()

app.get('/api/events', (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	})

	const listener = () => res.write(`data: updated\n\n`)
	syncEmitter.on('updated', listener)

	req.on('close', () => {
		syncEmitter.off('updated', listener)
	})
})

app.get('/api/entries', async (req, res) => {
	const { start, end } = req.query as { start?: string, end?: string }

	if (!start || !end) {
		return res.status(400).json({ error: 'Missing start or end date parameters' })
	}

	// The user is authenticated by middleware, but entries are global to the integration for now.
	// In a multi-user setup, we would filter by user.id

	const [startDate, endDate] = [new Date(start), new Date(end)]

	const em = orm.em.fork()
	const visibleSources = await em.find(Source, { hidden: false })
	const visibleSourceIds = visibleSources.map(source => source.id)
	const entries = await em.find(Entry, {
		sourceId: { $in: visibleSourceIds },
		$or: [
			{ start: { $gte: startDate, $lte: endDate } },
			{ end: { $gte: startDate, $lte: endDate } },
			{ start: { $lte: startDate }, end: { $gte: endDate } }
		]
	})

	return res.json(entries)
})

app.get('/api/integrations', async (_, res) => {
	const em = orm.em.fork()
	const integrations = await em.find(Integration, {}, { populate: ['sources'] })
	return res.json(integrations)
})

app.put('/api/sources/:id/visibility', async (req, res) => {
	const em = orm.em.fork()
	const source = await em.findOneOrFail(Source, { id: req.params.id })

	source.hidden = req.body.hidden
	await em.flush()

	syncEmitter.emit('updated')
	return res.json(source)
})

app.put('/api/entries/:id', async (req, res) => {
	const em = orm.em.fork()
	const existing = await em.findOneOrFail(Entry, { id: req.params.id })

	// The client sends the full edited entry; the backend diffs as needed.
	const body = req.body as Partial<Entry> & { sourceId?: string }

	// Resolve the current and target sources (and their integrations) by id.
	const targetSourceId = body.sourceId ?? existing.sourceId
	const [currentSource, targetSource] = await Promise.all([
		em.findOneOrFail(Source, { id: existing.sourceId }),
		em.findOneOrFail(Source, { id: targetSourceId }),
	])
	const [currentIntegration, targetIntegration] = await Promise.all([
		em.findOneOrFail(Integration, { id: currentSource.integrationId }),
		em.findOneOrFail(Integration, { id: targetSource.integrationId }),
	])

	const incoming = new Entry({
		sourceId: targetSource.id,
		type: existing.type,
		heading: body.heading ?? existing.heading,
		description: body.description ?? existing.description,
		color: body.color ?? targetSource.color,
		start: body.start ? new Date(body.start) as DateTime : existing.start,
		end: body.end ? new Date(body.end) as DateTime : existing.end,
		done: body.done ?? existing.done,
	})

	if (currentIntegration.id !== targetIntegration.id) {
		await currentIntegration.deleteEntry(em, existing)
		const created = await targetIntegration.createEntry(em, incoming)
		await em.flush()
		syncEmitter.emit('updated')
		return res.json(created)
	}

	await targetIntegration.updateEntry(em, existing, incoming)
	await em.flush()
	syncEmitter.emit('updated')
	return res.json(existing)
})

const frontendDistPath = path.resolve(import.meta.dirname, '../../dist')
app.use(express.static(frontendDistPath))

app.get(/(.*)/, (_, res) => {
	res.sendFile(path.join(frontendDistPath, 'index.html'))
})

// Central error handler. Express 5 forwards rejected promises from async route
// handlers here, so endpoints can simply throw (or let `findOneOrFail` throw).
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
	logger.error('Request failed:', error)
	const status = error instanceof NotFoundError ? 404 : 500
	res.status(status).json({ error: error.message })
}
app.use(errorHandler)

app.listen(PORT, () => logger.info(`Backend API running on http://localhost:${PORT}`))
