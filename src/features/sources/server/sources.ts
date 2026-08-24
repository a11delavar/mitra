import { Router } from 'express'
import { orm } from '../../../infrastructure/database/orm.js'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { User } from '../../identity/User.js'
import { Source } from '../Source.js'
import { applyOrder } from '../../../infrastructure/model/order.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { Integration } from '../../../integrations/Integration.js'
const logger = createLogger('Sources')

export const sourcesRouter = Router()

// The sidebar's manual order, applied wholesale: `ids` is ONE integration's sources in their new
// order — the rows the sidebar shows. Listed rows take their index; the integration's remaining
// rows (disabled ones) drop back to null, i.e. "append when they next appear" (see infrastructure/model/order.ts).
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

/** "Only show this calendar" (the rule is User.showOnly's). One request for the whole batch, so a
 * failure can't leave the calendar half-hidden. */
sourcesRouter.put('/:id/solo', async (req, res) => {
	const em = orm.em.fork()
	const source = await req.user.source(em, req.params.id)
	// Soloing a disabled source would hide everything and reveal nothing.
	if (!source.enabled) {
		return res.status(400).json({ error: 'A disabled source cannot be the only one shown' })
	}
	const user = await em.findOneOrFail(User, { id: req.user.id })
	user.showOnly(await req.user.sources(em, { enabled: true }), source.id)
	await em.flush()

	// Keep the request's user (a different entity manager's instance) in sync so a follow-up GET reflects the change.
	req.user.previouslyHiddenSourceIds = user.previouslyHiddenSourceIds
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Source ${source.id} is now the only one shown`)
	return res.json(user)
})

/** The way back out of a solo (see User.restorePreviousVisibility). */
sourcesRouter.put('/restore-visibility', async (req, res) => {
	const em = orm.em.fork()
	const user = await em.findOneOrFail(User, { id: req.user.id })
	// Nothing to restore is a no-op, not an error — "not in a solo" is what the caller asked for. Keeps
	// a second tab with a stale record from getting a button that throws instead of the current truth.
	// (Presence, not length: an empty record still means soloed.)
	if (!user.previouslyHiddenSourceIds) {
		return res.json(user)
	}

	user.restorePreviousVisibility(await req.user.sources(em, { enabled: true }))
	await em.flush()

	// Keep the request's user (a different entity manager's instance) in sync so a follow-up GET reflects the change.
	req.user.previouslyHiddenSourceIds = undefined
	syncEmitter.emit('updated', req.user.id)
	logger.debug('Restored the visibility from before the solo')
	return res.json(user)
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
