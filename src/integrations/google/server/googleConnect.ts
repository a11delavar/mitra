import { Router, type Request, type RequestHandler } from 'express'
import { cookie } from '#features/identity/server/auth.js'
import { Integration } from '#integrations'
import { orm } from '#infrastructure/database/orm.js'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { environment } from '#infrastructure/server/Environment.js'
import { GoogleCalendar } from '../GoogleCalendar.js'
import { GoogleOAuth } from './GoogleOAuth.js'

const logger = createLogger('Integrations')

export const googleOAuth = GoogleOAuth.of(environment)

GoogleCalendar.from(() => environment.google)

/** Keeps strangers' credentials off a demo box, and the box from fetching the URLs they type. */
const refusedInDemo: RequestHandler = (_req, res, next) => environment.demo
	? res.status(403).json({ error: 'Connecting accounts is turned off in the demo' })
	: next()

interface GoogleTransit {
	verifier: string
	state: string
	redirectUri: string
}

const googleTransitCookie = 'Mitra.GoogleAuth'

const requestOrigin = (req: Request) => `${req.protocol}://${req.get('host')}`

/** Google's consent round trip: redirects and a cookie carrying the PKCE verifier, which no operation answers with JSON. */
export const googleConnectRouter = Router()

googleConnectRouter.get('/connect', refusedInDemo, async (req, res) => {
	if (!googleOAuth) {
		return res.status(400).json({ error: 'Google Calendar is not configured. Set MITRA_GOOGLE_CLIENT_ID and MITRA_GOOGLE_CLIENT_SECRET' })
	}
	const redirectUri = googleOAuth.redirectUri(requestOrigin(req))
	const { url, verifier, state } = await googleOAuth.authorization(redirectUri)
	const transit: GoogleTransit = { verifier, state, redirectUri }
	res.cookie(googleTransitCookie, Buffer.from(JSON.stringify(transit)).toString('base64url'),
		{ httpOnly: true, sameSite: 'lax', secure: googleOAuth.secure, maxAge: 10 * 60 * 1000, path: '/api/integrations/google' })
	return res.redirect(url.href)
})

googleConnectRouter.get('/callback', async (req, res) => {
	if (typeof req.query.error === 'string') {
		logger.info(`Google consent was not granted: ${req.query.error}`)
		return res.redirect('/')
	}
	const raw = cookie(req, googleTransitCookie)
	if (!raw || !googleOAuth) {
		return res.redirect('/')
	}
	res.clearCookie(googleTransitCookie, { path: '/api/integrations/google' })
	const transit = JSON.parse(Buffer.from(raw, 'base64url').toString()) as GoogleTransit
	const { email, refreshToken } = await googleOAuth.callback(new URL(req.originalUrl, transit.redirectUri), transit.verifier, transit.state)

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
