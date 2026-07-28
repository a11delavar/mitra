import { Router, type Request } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { cookie } from './auth.js'
import { GoogleOAuth } from './GoogleOAuth.js'
import { Integration, GoogleCalendar, Source, applyOrder, createLogger, integrationClassFor } from '../shared/index.js'

const logger = createLogger('Integrations')

export const integrationsRouter = Router()

// Deliberately NO orderBy: the response stays in natural (insertion) order and the client applies
// the display comparator itself (`byOrder` at the fetchIntegrations boundary, see shared/order.ts).
// A SQL `order asc nulls last` was tried and reverted — SQLite's tie order under an ORDER BY is
// arbitrary, so the never-ordered rows (every pre-feature sidebar) could reshuffle; the client's
// STABLE sort keeps them exactly as they always were.
integrationsRouter.get('/', async (req, res) => {
	const em = orm.em.fork()
	const integrations = await em.find(Integration, { userId: req.user.id }, { populate: ['sources'] })
	return res.json(integrations)
})

// The sidebar's manual account order — the integration-level counterpart of PUT /sources/order:
// listed integrations take their index, an unlisted one drops back to null (see shared/order.ts).
// Registered before PUT /:id, which would otherwise read "order" as an id.
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

/** Google Calendar's OAuth consent flow (see GoogleOAuth.ts). Configured deployment-wide via env. */
const google = GoogleOAuth.fromEnv()

// Whether this deployment can connect Google accounts — drives the provider option in the add dialog.
integrationsRouter.get('/google', (_req, res) => res.json({ configured: !!google }))

/** The consent dance's cross-redirect state (PKCE verifier + CSRF state + the exact redirect URI the
 * flow started with), parked in a short-lived HttpOnly cookie — the same shape as auth.ts's Transit. */
interface GoogleTransit {
	verifier: string
	state: string
	redirectUri: string
}

const googleTransitCookie = 'Mitra.GoogleAuth'

const requestOrigin = (req: Request) => `${req.protocol}://${req.get('host')}`

// Starts the consent flow: a plain link target (the dialog navigates here), redirecting to Google.
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

// Google redirects back here (a top-level GET, so the Lax session cookie rides along). Exchanges the
// code for the refresh token, upserts the integration — reconnecting an already-connected account
// renews its grant in place, thanks to the (userId, uri) identity — and lands back in the app with
// the integration's source picker open (see Mitra.openPendingIntegration).
integrationsRouter.get('/google/callback', async (req, res) => {
	if (typeof req.query.error === 'string') {
		logger.info(`Google consent was not granted: ${req.query.error}`)
		return res.redirect('/')
	}
	const raw = cookie(req, googleTransitCookie)
	if (!raw || !google) {
		return res.redirect('/') // expired or cold callback — the user can restart from the dialog
	}
	res.clearCookie(googleTransitCookie, { path: '/api/integrations/google' })
	const transit = JSON.parse(Buffer.from(raw, 'base64url').toString()) as GoogleTransit
	// Reconstruct the "current URL" off the redirect URI the flow started with — behind a reverse
	// proxy the request's own protocol/host are the internal ones (mirrors auth.ts's callback).
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
	// Discover the account's calendars now (persisted disabled, per the opt-in data flow), so the
	// picker dialog opens populated. A discovery failure (e.g. the CalDAV API not enabled in the
	// cloud project) still keeps the connected account — the dialog's Refresh surfaces the error.
	await integration.getSources(em).catch(error =>
		logger.warn(`Connected ${integration.toString()}, but calendar discovery failed: ${error instanceof Error ? error.message : error}`))
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.info(`Connected ${integration.toString()}`)
	return res.redirect(`/?integration=${integration.id}`)
})

// Validate credentials and preview the available sources without persisting anything. On edit the
// client omits the password, so we start from the stored integration (by id) so `merge` reuses it.
integrationsRouter.post('/sources', async (req, res) => {
	const incoming = req.body as Integration
	const em = orm.em.fork()
	const integration: Integration = await em.findOne(Integration, { id: incoming.id, userId: req.user.id })
		?? new (integrationClassFor(incoming.type))({ userId: req.user.id })
	integration.merge(incoming)
	// checkDuplicate: surface an already-connected account in the dialog's Connect step, before Save.
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

// Full re-import of every enabled source (see Integration.reimportSource) — the integration-wide
// counterpart of POST /sources/:id/reimport. There is deliberately no manual SYNC endpoint beside
// it: syncing is the daemon's job, triggered by presence (an opening/reloading client syncs its
// user's integrations immediately), so the app never needs to ask.
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
	// Sources and their entries are removed by the ON DELETE CASCADE foreign keys.
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.info(`Disconnected integration ${integration.id}`)
	return res.status(204).end()
})
