import { Router, type Request } from 'express'
import { orm } from '../../infrastructure/database/orm.js'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { cookie } from '../../features/identity/server/auth.js'
import { GoogleOAuth } from '../google/server/GoogleOAuth.js'
import { Source } from '../../features/sources/Source.js'
import { applyOrder } from '../../infrastructure/model/order.js'
import { createLogger } from '../../infrastructure/logging/Logger.js'
import { Integration, integrationClassFor } from '../Integration.js'
import { GoogleCalendar } from '../google/GoogleCalendar.js'
const logger = createLogger('Integrations')

export const integrationsRouter = Router()

integrationsRouter.get('/', async (req, res) => {
	const em = orm.em.fork()
	const integrations = await em.find(Integration, { userId: req.user.id }, { populate: ['sources'] })
	return res.json(integrations)
})

integrationsRouter.put('/order', async (req, res) => {
	const ids = req.body.ids as Array<string>
	if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
		return res.status(400).json({ error: 'A list of unique integration ids is required' })
	}
	const em = orm.em.fork()
	const integrations = await req.user.integrations(em)
	const owned = new Set(integrations.map(integration => integration.id))
	if (ids.some(id => !owned.has(id))) {
		return res.status(404).json({ error: 'Unknown integration' })
	}
	applyOrder(integrations, ids)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Reordered ${ids.length} integration(s)`)
	return res.status(204).end()
})

const google = GoogleOAuth.fromEnv()

integrationsRouter.get('/google', (_req, res) => res.json({ configured: !!google }))

interface GoogleTransit {
	verifier: string
	state: string
	redirectUri: string
}

const googleTransitCookie = 'Mitra.GoogleAuth'

const requestOrigin = (req: Request) => `${req.protocol}://${req.get('host')}`

integrationsRouter.get('/google/connect', async (req, res) => {
	if (!google) {
		return res.status(400).json({ error: 'Google Calendar is not configured — set MITRA_GOOGLE_CLIENT_ID and MITRA_GOOGLE_CLIENT_SECRET' })
	}
	const redirectUri = google.redirectUri(requestOrigin(req))
	const { url, verifier, state } = await google.authorization(redirectUri)
	const transit: GoogleTransit = { verifier, state, redirectUri }
	res.cookie(googleTransitCookie, Buffer.from(JSON.stringify(transit)).toString('base64url'),
		{ httpOnly: true, sameSite: 'lax', secure: google.secure, maxAge: 10 * 60 * 1000, path: '/api/integrations/google' })
	return res.redirect(url.href)
})

integrationsRouter.get('/google/callback', async (req, res) => {
	if (typeof req.query.error === 'string') {
		logger.info(`Google consent was not granted: ${req.query.error}`)
		return res.redirect('/')
	}
	const raw = cookie(req, googleTransitCookie)
	if (!raw || !google) {
		return res.redirect('/')
	}
	res.clearCookie(googleTransitCookie, { path: '/api/integrations/google' })
	const transit = JSON.parse(Buffer.from(raw, 'base64url').toString()) as GoogleTransit
	const { email, refreshToken } = await google.callback(new URL(req.originalUrl, transit.redirectUri), transit.verifier, transit.state)

	const em = orm.em.fork()
	const uri = GoogleCalendar.uriFor(email)
	let integration = await em.findOne(GoogleCalendar, { userId: req.user.id, uri })
	if (integration) {
		integration.credentials = { username: email, refreshToken }
	} else {
		integration = new GoogleCalendar({ userId: req.user.id, uri, credentials: { username: email, refreshToken } })
		em.persist(integration)
	}
	await Integration.exclusively(integration.id, async () => {
		await integration!.getSources(em)
		await em.flush()
	}).catch(error =>
		logger.warn(`Connected ${integration.toString()}, but calendar discovery failed: ${error instanceof Error ? error.message : error}`))
	syncEmitter.emit('updated', req.user.id)
	logger.info(`Connected ${integration.toString()}`)
	return res.redirect(`/?integration=${integration.id}`)
})

integrationsRouter.post('/sources', async (req, res) => {
	const incoming = req.body as Integration
	const em = orm.em.fork()
	const integration: Integration = await em.findOne(Integration, { id: incoming.id, userId: req.user.id })
		?? new (integrationClassFor(incoming.type))({ userId: req.user.id })
	integration.merge(incoming)
	return res.json(await integration.getSources(em, { checkDuplicate: true }))
})

integrationsRouter.post('/', async (req, res) => {
	const incoming = req.body as Integration
	const em = orm.em.fork()
	const integration: Integration = new (integrationClassFor(incoming.type))({ userId: req.user.id })
	em.persist(integration)
	await integration.applyAndSync(em, incoming)
	syncEmitter.emit('updated', req.user.id)
	const saved = await em.findOneOrFail(Integration, { id: integration.id }, { populate: ['sources'] })
	const enabled = saved.sources.getItems().filter(source => source.enabled).length
	logger.info(`Connected ${integration.type} integration with ${enabled} source(s) enabled`)
	return res.status(201).json(saved)
})

integrationsRouter.put('/:id', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	await integration.applyAndSync(em, req.body as Integration)
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Updated integration ${integration.id}`)
	return res.json(await em.findOneOrFail(Integration, { id: integration.id }, { populate: ['sources'] }))
})

integrationsRouter.post('/:id/reimport', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	const sources = await em.find(Source, { integrationId: integration.id, enabled: true })
	for (const source of sources) {
		await integration.reimportSource(em, source)
	}
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.info(`Re-imported integration ${integration.id} (${sources.length} source(s))`)
	return res.status(204).end()
})

integrationsRouter.delete('/:id', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	em.remove(integration)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.info(`Disconnected integration ${integration.id}`)
	return res.status(204).end()
})
