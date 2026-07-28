import { Router } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Integration, Source, applyOrder, createLogger } from '../shared/index.js'

const logger = createLogger('Sources')

export const sourcesRouter = Router()

// The sidebar's manual order, applied wholesale: `ids` is ONE integration's sources in their new
// order — the rows the sidebar shows. Listed rows take their index; the integration's remaining
// rows (disabled ones) drop back to null, i.e. "append when they next appear" (see shared/order.ts).
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

// Full re-import: rebuild the source's local cache from the provider (see Integration.reimportSource).
// Distinct from the background SYNC, which only pulls deltas and needs no endpoint of its own.
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

	// A blank name would leave an unlabelled row with nothing to grab for a future rename; reject it.
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
