import type { EntityManager } from '@mikro-orm/sqlite'
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { languages } from '#integrations/demo/i18n/dictionaries.js'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { orm } from '#infrastructure/database/orm.js'
import type { Environment } from '#infrastructure/server/Environment.js'
import { User } from '../User.js'
import type { AccessToken } from '../AccessToken.js'
import { OidcClient } from './OidcClient.js'
import { Session } from './Session.js'
import { Cookie } from './Cookie.js'
import { Sandbox } from './Sandbox.js'

declare global {
	namespace Express {
		interface Request {
			/** The signed-in user, attached by {@link Authentication.middleware} before any route runs. */
			user: User
			/** The access token an agent signed in with (`accessTokenMiddleware`), which bounds what it may do. */
			accessToken?: AccessToken
		}
	}
}

const logger = createLogger('Auth')

/** What the browser carries across the provider's round trip: the PKCE verifier, the state, and where to go back to. */
interface Transit {
	verifier: string
	state: string
	returnTo?: string
}

/**
 * How the instance signs a request in, by its mode: the one local account, a session the identity provider began, or a
 * sandbox for each demo visitor. An agent's access token signs it in before any of them (`accessTokenMiddleware`).
 */
export abstract class Authentication {
	/** The instance's mode: a demo wins over a provider, and without either the one local account, which a developer keeps beside a provider. */
	static async of(em: EntityManager, environment: Environment) {
		const client = OidcClient.of(environment)
		const authentication = await Authentication.for(em, environment, client)
		logger.info(authentication.description)
		return authentication
	}

	private static async for(em: EntityManager, environment: Environment, client: OidcClient | undefined): Promise<Authentication> {
		if (!client) {
			const local = await User.local(em)
			return environment.demo ? new DemoVisitors(environment) : new LocalAccount(environment, local)
		}
		if (environment.developer) {
			await User.local(em)
		}
		return environment.demo ? new DemoVisitors(environment) : new Oidc(environment, client)
	}

	constructor(protected readonly environment: Environment) { }

	/** What the instance runs as, logged as the server starts. */
	protected abstract readonly description: string

	/** The routes signing in and out at `/auth`, where a mode has any. */
	get router(): Router | undefined {
		return undefined
	}

	/** The session cookie, secure where the instance is served over HTTPS. */
	get sessionCookie() {
		return Session.cookieFor(this.environment)
	}

	readonly middleware: RequestHandler = (req, res, next) => req.accessToken ? next() : this.authenticate(req, res, next)

	protected abstract authenticate(req: Request, res: Response, next: NextFunction): unknown

	/** The user behind the session cookie, renewing the session as it slides and clearing a dead one. */
	protected async sessionUser(req: Request, res: Response) {
		const token = this.sessionCookie.readIn(req)
		if (!token) {
			return undefined
		}
		const em = orm.em.fork()
		const session = await Session.of(em, token)
		const user = session && !session.expired ? await em.findOne(User, { id: session.userId }) : undefined
		if (session && user) {
			if (session.shouldRenew) {
				session.renew()
				await em.flush()
				this.sessionCookie.write(res, token)
				logger.debug(`Renewed session for user ${user.id}`)
			}
			return user
		}
		if (session) {
			em.remove(session)
			await em.flush()
			logger.debug('Cleared an expired or orphaned session')
		}
		this.sessionCookie.clear(res)
		return undefined
	}
}

/** Single-user mode: every request is the one local account's. */
class LocalAccount extends Authentication {
	protected readonly description = 'Single-user mode: no authentication (set MITRA_OIDC_ISSUER to enable multi-user sign-in)'

	constructor(environment: Environment, private readonly user: User) {
		super(environment)
	}

	protected authenticate(req: Request, _res: Response, next: NextFunction) {
		req.user = this.user
		next()
	}
}

/**
 * Multi-user mode, signing in through an OpenID Connect provider: a request is its session's user; without one the API
 * answers 401 and a page goes to sign in, which `/auth` begins at the provider.
 */
class Oidc extends Authentication {
	private readonly transit: Cookie

	constructor(environment: Environment, private readonly client: OidcClient) {
		super(environment)
		this.transit = new Cookie('Mitra.Auth', { httpOnly: true, sameSite: 'lax', secure: client.secure, maxAge: 10 * 60 * 1000, path: '/auth' })
	}

	protected get description() {
		return `Multi-user mode: OIDC against ${this.client.issuer} (redirect URI ${this.client.redirectUri})`
	}

	protected async authenticate(req: Request, res: Response, next: NextFunction) {
		const user = await this.sessionUser(req, res)
		if (user) {
			req.user = user
			return next()
		}
		if (req.path.startsWith('/api/')) {
			return res.status(401).json({ error: 'Unauthenticated' })
		}
		if (req.method !== 'GET' || req.path.includes('.')) {
			return next()
		}
		return res.redirect(`/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`)
	}

	/** Where a sign-in may go back to: only a path on this site, read as a browser reads it (`/\host` is `//host`). */
	private pathOnThisSite(requested: unknown) {
		if (typeof requested !== 'string') {
			return undefined
		}
		const url = new URL(requested, this.client.baseUrl)
		return url.origin === this.client.baseUrl.origin ? `${url.pathname}${url.search}${url.hash}` : undefined
	}

	/** Signing in and out here: redirects and cookies, which no operation answers with JSON. */
	override get router() {
		const router = Router()

		router.get('/login', async (req, res) => {
			const { url, verifier, state } = await this.client.authorization()
			const transit: Transit = { verifier, state, returnTo: this.pathOnThisSite(req.query.returnTo) }
			this.transit.write(res, Buffer.from(JSON.stringify(transit)).toString('base64url'))
			return res.redirect(url.href)
		})

		router.get('/callback', async (req, res) => {
			const raw = this.transit.readIn(req)
			if (!raw) {
				return res.redirect('/auth/login')
			}
			this.transit.clear(res)
			logger.debug('OIDC callback received; exchanging authorization code')
			const transit = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Transit
			const { claims, idToken } = await this.client.callback(new URL(req.originalUrl, this.client.baseUrl), transit.verifier, transit.state)
			const em = orm.em.fork()
			const user = await User.provision(em, this.client.issuer, claims)
			const { session, token } = Session.issue(user, idToken)
			em.persist(session)
			await em.flush()
			logger.info(`Signed in ${user.identity?.name || user.identity?.email || user.identity?.subject}`)
			this.sessionCookie.write(res, token)
			return res.redirect(transit.returnTo ?? '/')
		})

		router.get('/logout', async (req, res) => {
			const token = this.sessionCookie.readIn(req)
			const em = orm.em.fork()
			const session = token ? await Session.of(em, token) : undefined
			if (session) {
				em.remove(session)
				await em.flush()
				logger.info(`Signed out user ${session.userId}`)
			}
			this.sessionCookie.clear(res)
			const endSession = await this.client.endSessionUrl(session?.idToken)
			return res.redirect(endSession?.href ?? '/')
		})

		return router
	}
}

/** Demo mode: where multi-user mode would ask for a sign-in, a new visitor gets a sandbox. */
class DemoVisitors extends Authentication {
	protected readonly description = 'Demo mode: every visitor gets a sandbox with the sample calendar'

	protected async authenticate(req: Request, res: Response, next: NextFunction) {
		const returning = await this.sessionUser(req, res)
		if (returning) {
			req.user = returning
			return next()
		}
		// A crawler fetching an asset must not leave a sandbox behind. A visit always starts with the document.
		if (!req.path.startsWith('/api/') && req.path.includes('.')) {
			return next()
		}
		const { user, token } = await Sandbox.open(orm.em.fork(), req.acceptsLanguages(...languages) || undefined)
		this.sessionCookie.write(res, token)
		logger.info(`Opened a sandbox for a new visitor (user ${user.id})`)
		req.user = user
		return next()
	}
}
