import { Router, type Request, type RequestHandler } from 'express'
import { orm } from '../../infrastructure/database/orm.js'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { cookie } from '../../features/identity/server/auth.js'
import { GoogleOAuth } from '../google/server/GoogleOAuth.js'
import { Source } from '../../features/sources/Source.js'
import { Color } from '../../features/sources/Color.js'
import { EntryTypes } from '../../features/entries/EntryType.js'
import { applyOrder } from '../../infrastructure/model/order.js'
import { createLogger } from '../../infrastructure/logging/Logger.js'
import { isDemo, isDeveloperSystem } from '../../infrastructure/environment.js'
import { Integration, integrationClassFor } from '../Integration.js'
import { GoogleCalendar } from '../google/GoogleCalendar.js'
import { importer } from './Importer.js'
const logger = createLogger('Integrations')

export const integrationsRouter = Router()

/** Keeps strangers' credentials off a demo box, and the box from fetching the URLs they type. */
const refusedInDemo: RequestHandler = (_req, res, next) => isDemo
	? res.status(403).json({ error: 'Connecting accounts is turned off in the demo' })
	: next()

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
	syncEmitter.emit('updated', req.user.id, 'sources')
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

integrationsRouter.get('/google/connect', refusedInDemo, async (req, res) => {
	if (!google) {
		return res.status(400).json({ error: 'Google Calendar is not configured. Set MITRA_GOOGLE_CLIENT_ID and MITRA_GOOGLE_CLIENT_SECRET' })
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
	syncEmitter.emit('updated', req.user.id, 'sources')
	logger.info(`Connected ${integration.toString()}`)
	return res.redirect(`/?integration=${integration.id}`)
})

integrationsRouter.post('/sources', refusedInDemo, async (req, res) => {
	const incoming = req.body as Integration
	const em = orm.em.fork()
	const integration: Integration = await em.findOne(Integration, { id: incoming.id, userId: req.user.id })
		?? new (integrationClassFor(incoming.type))({ userId: req.user.id })
	integration.merge(incoming)
	return res.json(await integration.getSources(em, { checkDuplicate: true }))
})

integrationsRouter.post('/', refusedInDemo, async (req, res) => {
	const incoming = req.body as Integration
	if (integrationClassFor(incoming.type).developmentOnly && !isDeveloperSystem) {
		return res.status(403).json({ error: 'This integration is only available on a development system' })
	}
	const em = orm.em.fork()
	const integration: Integration = new (integrationClassFor(incoming.type))({ userId: req.user.id })
	em.persist(integration)
	await integration.apply(em, incoming)
	syncEmitter.emit('updated', req.user.id, 'sources')
	// Fork fresh context to populate newly created sources collection.
	const saved = await em.fork().findOneOrFail(Integration, { id: integration.id }, { populate: ['sources'] })
	const enabled = saved.sources.getItems().filter(source => source.enabled).length
	logger.info(`Connected ${integration.type} integration with ${enabled} source(s) enabled`)
	void importer.start(em, req.user.id, integration.id)
	return res.status(201).json(saved)
})

integrationsRouter.post('/:id/sources', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	if (!integration.capabilities.createSources) {
		return res.status(403).json({ error: 'This integration cannot create calendars from mitra' })
	}

	const name = String(req.body.name ?? '').trim()
	if (!name) {
		return res.status(400).json({ error: 'A name is required' })
	}

	// Only pass entryTypes when given: undefined would overwrite Source's default.
	let entryTypes: EntryTypes | undefined
	try {
		entryTypes = req.body.entryTypes === undefined ? undefined : EntryTypes.parse(req.body.entryTypes)
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
	}

	const siblings = await em.find(Source, { integrationId: integration.id })
	const source = new Source({
		name,
		enabled: true,
		hidden: false,
		color: req.body.color ? String(req.body.color) : Color.unusedAmong(siblings.map(sibling => sibling.color)),
		...entryTypes ? { entryTypes } : {},
	})
	await integration.createSource(em, source)
	await em.flush()

	syncEmitter.emit('updated', req.user.id, 'sources')
	logger.info(`Created source "${source.name}" (${source.id}) in integration ${integration.id}`)
	return res.status(201).json(source)
})

integrationsRouter.put('/:id', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	await integration.apply(em, req.body as Integration)
	syncEmitter.emit('updated', req.user.id, 'sources')
	logger.debug(`Updated integration ${integration.id}`)
	// Fork fresh context to populate newly created sources collection.
	const saved = await em.fork().findOneOrFail(Integration, { id: integration.id }, { populate: ['sources'] })
	void importer.start(em, req.user.id, integration.id)
	return res.json(saved)
})

integrationsRouter.post('/:id/reimport', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	const sources = await em.find(Source, { integrationId: integration.id, enabled: true })
	for (const source of sources) {
		await integration.reimportSource(em, source)
	}
	syncEmitter.emit('updated', req.user.id, 'sources')
	void importer.start(em, req.user.id, integration.id)
	logger.info(`Re-importing integration ${integration.id} (${sources.length} source(s))`)
	return res.status(202).end()
})

integrationsRouter.delete('/:id', async (req, res) => {
	const em = orm.em.fork()
	const integration = await req.user.integration(em, req.params.id)
	em.remove(integration)
	await em.flush()
	syncEmitter.emit('updated', req.user.id, 'sources')
	logger.info(`Disconnected integration ${integration.id}`)
	return res.status(204).end()
})
