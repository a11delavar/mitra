import { Router, type Request, type Response } from 'express'
import { orm } from '../../../infrastructure/database/orm.js'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { User } from '../../identity/User.js'
import { Source } from '../Source.js'
import { applyOrder } from '../../../infrastructure/model/order.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { Integration } from '../../../integrations/Integration.js'
import { MigrationRefused, SourceMigration } from '../../migration/server/SourceMigration.js'
const logger = createLogger('Sources')

export const sourcesRouter = Router()

sourcesRouter.put('/order', async (req, res) => {
	const ids = req.body.ids as Array<string>
	if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
		return res.status(400).json({ error: 'A list of unique source ids is required' })
	}
	const em = orm.em.fork()
	const sources = await req.user.sources(em, { id: { $in: ids } })
	if (sources.length !== ids.length) {
		return res.status(404).json({ error: 'Unknown source' })
	}
	if (new Set(sources.map(source => source.integrationId)).size > 1) {
		return res.status(400).json({ error: 'Sources can only be reordered within their integration' })
	}
	applyOrder(await em.find(Source, { integrationId: sources[0]!.integrationId }), ids)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Reordered ${ids.length} source(s)`)
	return res.status(204).end()
})

sourcesRouter.put('/:id/visibility', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)

	source.hidden = req.body.hidden
	await em.flush()

	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Source ${source.id} ${source.hidden ? 'hidden' : 'shown'}`)
	return res.json(source)
})

sourcesRouter.put('/:id/solo', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)
	if (!source.enabled) {
		return res.status(400).json({ error: 'A disabled source cannot be the only one shown' })
	}
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.showOnly(await req.user.sources(em, { enabled: true }), source.id)
	await em.flush()

	req.user.previouslyHiddenSourceIds = user.previouslyHiddenSourceIds
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Source ${source.id} is now the only one shown`)
	return res.json(user)
})

sourcesRouter.put('/restore-visibility', async (req, res) => {
	const em = orm.em.fork()
	const user = await em.findOneOrFail(User, { id: req.user.id })
	if (!user.previouslyHiddenSourceIds) {
		return res.json(user)
	}

	user.restorePreviousVisibility(await req.user.sources(em, { enabled: true }))
	await em.flush()

	req.user.previouslyHiddenSourceIds = undefined
	syncEmitter.emit('updated', req.user.id)
	logger.debug('Restored the visibility from before the solo')
	return res.json(user)
})

sourcesRouter.post('/:id/reimport', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)
	const integration = await em.findOneOrFail(Integration, { id: source.integrationId })

	await integration.reimportSource(em, source)
	await em.flush()

	syncEmitter.emit('updated', req.user.id)
	logger.info(`Re-imported source "${source.name}" (${source.id})`)
	return res.status(204).end()
})

async function migration(req: Request<{ id: string }>, res: Response, work: (migration: SourceMigration) => Promise<unknown>) {
	try {
		return res.json(await work(await SourceMigration.of(orm.em.fork(), req.user, req.params.id, req.body ?? {})))
	} catch (error) {
		if (error instanceof MigrationRefused) {
			return res.status(400).json({ error: error.message })
		}
		throw error
	}
}

sourcesRouter.post('/:id/migrate/preview', (req, res) => migration(req, res, source => Promise.resolve(source.plan())))

sourcesRouter.post('/:id/migrate', (req, res) => migration(req, res, async source => {
	const outcome = await source.run()
	syncEmitter.emit('updated', req.user.id)
	logger.info(`Migrated entries from source ${req.params.id} to ${String(req.body?.targetSourceId)}: ${JSON.stringify(outcome)}`)
	return outcome
}))

sourcesRouter.put('/:id/color', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)

	source.color = req.body.color
	await em.flush()

	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Source ${source.id} recoloured to ${source.color}`)
	return res.json(source)
})

sourcesRouter.put('/:id/name', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)

	const name = String(req.body.name ?? '').trim()
	if (!name) {
		return res.status(400).json({ error: 'A name is required' })
	}

	source.name = name
	await em.flush()

	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Source ${source.id} renamed to "${source.name}"`)
	return res.json(source)
})
