import { Router } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Integration, CalDAV, Source } from '../shared/index.js'

export const integrationsRouter = Router()

integrationsRouter.get('/', async (req, res) => {
	const em = orm.em.fork()
	const integrations = await em.find(Integration, { userId: req.user.id }, { populate: ['sources'] })
	return res.json(integrations)
})

// Validate credentials and preview the available sources without persisting anything. On edit the
// client omits the password, so we start from the stored integration (by id) so `merge` reuses it.
integrationsRouter.post('/sources', async (req, res) => {
	const incoming = req.body as Integration
	const em = orm.em.fork()
	const integration: Integration = await em.findOne(Integration, { id: incoming.id, userId: req.user.id }) ?? new CalDAV({ userId: req.user.id })
	integration.merge(incoming)
	return res.json(await integration.getSources(em))
})

integrationsRouter.post('/', async (req, res) => {
	const em = orm.em.fork()
	const integration: Integration = new CalDAV({ userId: req.user.id })
	em.persist(integration)
	await integration.applyAndSync(em, req.body as Integration)
	syncEmitter.emit('updated', req.user.id)
	return res.status(201).json(await em.findOneOrFail(Integration, { id: integration.id }, { populate: ['sources'] }))
})

integrationsRouter.put('/:id', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	await integration.applyAndSync(em, req.body as Integration)
	syncEmitter.emit('updated', req.user.id)
	return res.json(await em.findOneOrFail(Integration, { id: integration.id }, { populate: ['sources'] }))
})

// Full re-import of every enabled source (see Integration.resyncSource) — the integration-wide
// counterpart of POST /sources/:id/resync.
integrationsRouter.post('/:id/resync', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	for (const source of await em.find(Source, { integrationId: integration.id, enabled: true })) {
		await integration.resyncSource(em, source)
	}
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	return res.status(204).end()
})

integrationsRouter.delete('/:id', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	em.remove(integration)
	// Sources and their entries are removed by the ON DELETE CASCADE foreign keys.
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	return res.status(204).end()
})
