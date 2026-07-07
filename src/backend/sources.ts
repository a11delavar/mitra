import { Router } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Integration, createLogger } from '../shared/index.js'

const logger = createLogger('Sources')

export const sourcesRouter = Router()

sourcesRouter.put('/:id/visibility', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)

	source.hidden = req.body.hidden
	await em.flush()

	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Source ${source.id} ${source.hidden ? 'hidden' : 'shown'}`)
	return res.json(source)
})

// Full re-import: rebuild the source's local cache from the provider (see Integration.resyncSource).
sourcesRouter.post('/:id/resync', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)
	const integration = await em.findOneOrFail(Integration, { id: source.integrationId })

	await integration.resyncSource(em, source)
	await em.flush()

	syncEmitter.emit('updated', req.user.id)
	logger.info(`Re-imported source "${source.name}" (${source.id})`)
	return res.status(204).end()
})

sourcesRouter.put('/:id/color', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)

	source.color = req.body.color
	await em.flush()

	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Source ${source.id} recoloured to ${source.color}`)
	return res.json(source)
})
