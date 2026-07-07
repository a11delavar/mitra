import { Router, type Request, type RequestHandler, type Response } from 'express'
import { User, createLogger } from '../shared/index.js'
import { orm } from './orm.js'
import { Oidc } from './Oidc.js'
import { Session } from './Session.js'

declare global {
	namespace Express {
		interface Request {
			/** The authenticated user — attached by {@link authMiddleware} before any route runs. */
			user: User
		}
	}
}

const logger = createLogger('Auth')

/** Multi-user mode when configured (see Oidc.fromEnv); otherwise zero-auth single-user. */
export const oidc = Oidc.fromEnv()

// The pre-auth single-user row, seeded for single-user mode (and for dev seeding, which targets it).
// Multi-user mode never touches it — every OIDC identity gets its own fresh user.
async function findOrSeedDefaultUser(): Promise<User> {
	const existing = await orm.em.findOne(User, { username: User.default.username })
	if (existing) {
		return existing
	}
	const user = User.default
	orm.em.persist(user)
	await orm.em.flush()
	logger.debug('Seeded the single-user default account')
	return user
}

const defaultUser = oidc && process.env.MITRA_DEV !== 'true'
	? undefined
	: await findOrSeedDefaultUser()

// Expired sessions self-delete when touched; this sweeps the ones whose browsers never came back.
const sweptSessions = await orm.em.nativeDelete(Session, { expiresAt: { $lt: new Date() } })
if (sweptSessions) {
	logger.debug(`Swept ${sweptSessions} expired session(s) at boot`)
}

/** Parse one cookie out of the raw header — the app has exactly two cookies, not worth a dependency. */
function cookie(req: Request, name: string): string | undefined {
	for (const pair of req.headers.cookie?.split(';') ?? []) {
		const separator = pair.indexOf('=')
		if (pair.slice(0, separator).trim() === name) {
			return decodeURIComponent(pair.slice(separator + 1).trim())
		}
	}
	return undefined
}

function setSessionCookie(res: Response, token: string) {
	res.cookie(Session.cookie, token, { httpOnly: true, sameSite: 'lax', secure: oidc?.secure ?? false, maxAge: Session.lifetime, path: '/' })
}

/** Zero-auth single-user mode: every request is the default user. */
const singleUser: RequestHandler = (req, _res, next) => {
	req.user = defaultUser!
	next()
}

/**
 * Multi-user (OIDC) mode: resolves the session cookie to its user. Unauthenticated requests split by
 * kind — API calls answer a plain 401 (the frontend bounces itself through /auth/login), asset
 * requests pass (bundles and the PWA manifest are the app's code, not data — and installability dies
 * if the manifest redirects), and page navigations redirect into the sign-in flow. CSRF rests on the
 * cookie being SameSite=Lax: cross-site subrequests simply arrive unauthenticated.
 */
const session: RequestHandler = async (req, res, next) => {
	const token = cookie(req, Session.cookie)
	if (token) {
		const em = orm.em.fork()
		const found = await em.findOne(Session, { id: Session.idFor(token) })
		if (found && !found.expired) {
			const user = await em.findOne(User, { id: found.userId })
			if (user) {
				if (found.shouldRenew) {
					found.renew()
					await em.flush()
					setSessionCookie(res, token)
					logger.debug(`Renewed session for user ${user.id}`)
				}
				req.user = user
				return next()
			}
		}
		if (found) {
			em.remove(found)
			await em.flush()
			logger.debug('Cleared an expired or orphaned session')
		}
		res.clearCookie(Session.cookie, { path: '/' })
	}
	if (req.path.startsWith('/api/')) {
		return res.status(401).json({ error: 'Unauthenticated' })
	}
	if (req.method !== 'GET' || req.path.includes('.')) {
		return next()
	}
	return res.redirect(`/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`)
}

export const authMiddleware: RequestHandler = oidc ? session : singleUser

/** The sign-in dance's cross-redirect state (PKCE verifier + CSRF state + the deep link to return
 * to), parked in a short-lived HttpOnly cookie between /auth/login and /auth/callback. */
interface Transit {
	verifier: string
	state: string
	returnTo?: string
}

const transitCookie = 'Mitra.Auth'

/** The interactive sign-in/out endpoints — mounted at /auth, and only in multi-user mode (server.ts). */
export const authRouter = Router()

authRouter.get('/login', async (req, res) => {
	const { url, verifier, state } = await oidc!.authorization()
	const requested = typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined
	// Only same-app paths ride along — an absolute URL here would be an open redirect.
	const returnTo = requested?.startsWith('/') && !requested.startsWith('//') ? requested : undefined
	const transit: Transit = { verifier, state, returnTo }
	res.cookie(transitCookie, Buffer.from(JSON.stringify(transit)).toString('base64url'),
		{ httpOnly: true, sameSite: 'lax', secure: oidc!.secure, maxAge: 10 * 60 * 1000, path: '/auth' })
	return res.redirect(url.href)
})

authRouter.get('/callback', async (req, res) => {
	const raw = cookie(req, transitCookie)
	if (!raw) {
		return res.redirect('/auth/login') // expired or cold callback — restart the dance
	}
	res.clearCookie(transitCookie, { path: '/auth' })
	logger.debug('OIDC callback received; exchanging authorization code')
	const transit = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Transit
	// The exchange validates the callback against the registered redirect URI — reconstruct the
	// "current URL" off the configured base too, since behind the reverse proxy the request's own
	// protocol/host are the internal ones.
	const { claims, idToken } = await oidc!.callback(new URL(req.originalUrl, oidc!.baseUrl), transit.verifier, transit.state)
	const em = orm.em.fork()
	const user = await User.provision(em, oidc!.issuer, claims)
	const { session, token } = Session.issue(user, idToken)
	em.persist(session)
	await em.flush()
	logger.info(`Signed in ${user.identity?.name || user.identity?.email || user.identity?.subject}`)
	setSessionCookie(res, token)
	return res.redirect(transit.returnTo ?? '/')
})

// GET on purpose: signing out is a plain link, and a cross-site-forged logout is an annoyance, not a breach.
authRouter.get('/logout', async (req, res) => {
	const token = cookie(req, Session.cookie)
	let idToken: string | undefined
	if (token) {
		const em = orm.em.fork()
		const session = await em.findOne(Session, { id: Session.idFor(token) })
		if (session) {
			idToken = session.idToken
			em.remove(session)
			await em.flush()
			logger.info(`Signed out user ${session.userId}`)
		}
	}
	res.clearCookie(Session.cookie, { path: '/' })
	const endSession = await oidc!.endSessionUrl(idToken)
	return res.redirect(endSession?.href ?? '/')
})
