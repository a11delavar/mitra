import { Router, type Request, type RequestHandler, type Response } from 'express'
import { User } from '../User.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { orm } from '../../../infrastructure/database/orm.js'
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

export const oidc = Oidc.fromEnv()

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

const sweptSessions = await orm.em.nativeDelete(Session, { expiresAt: { $lt: new Date() } })
if (sweptSessions) {
	logger.debug(`Swept ${sweptSessions} expired session(s) at boot`)
}

/** Parses named cookie value from the request Cookie header. */
export function cookie(req: Request, name: string): string | undefined {
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

const singleUser: RequestHandler = (req, _res, next) => {
	req.user = defaultUser!
	next()
}

/** Resolves session cookies in multi-user mode, redirecting unauthenticated page requests to login. */
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

interface Transit {
	verifier: string
	state: string
	returnTo?: string
}

const transitCookie = 'Mitra.Auth'

export const authRouter = Router()

authRouter.get('/login', async (req, res) => {
	const { url, verifier, state } = await oidc!.authorization()
	const requested = typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined
	const returnTo = requested?.startsWith('/') && !requested.startsWith('//') ? requested : undefined
	const transit: Transit = { verifier, state, returnTo }
	res.cookie(transitCookie, Buffer.from(JSON.stringify(transit)).toString('base64url'),
		{ httpOnly: true, sameSite: 'lax', secure: oidc!.secure, maxAge: 10 * 60 * 1000, path: '/auth' })
	return res.redirect(url.href)
})

authRouter.get('/callback', async (req, res) => {
	const raw = cookie(req, transitCookie)
	if (!raw) {
		return res.redirect('/auth/login')
	}
	res.clearCookie(transitCookie, { path: '/auth' })
	logger.debug('OIDC callback received; exchanging authorization code')
	const transit = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Transit
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
