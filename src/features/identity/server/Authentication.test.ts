import { describe, it, before, after, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import express from 'express'
import type { MikroORM } from '@mikro-orm/sqlite'
import { Environment } from '#infrastructure/server/Environment.js'
import { User } from '../User.js'
import { Session } from './Session.js'
import type { Authentication as AuthenticationType } from './Authentication.js'
import type { OidcClient as OidcClientType } from './OidcClient.js'

const provider = {
	MITRA_OIDC_ISSUER: 'https://idp.example.com/realms/home',
	MITRA_OIDC_CLIENT_ID: 'mitra',
	MITRA_URL: 'https://calendar.example.com',
}

describe('Authentication', () => {
	let orm: MikroORM
	let Authentication: typeof AuthenticationType
	let OidcClient: typeof OidcClientType
	before(async () => {
		// After the test file has loaded: the database opens on import.
		({ orm } = await import('#infrastructure/database/orm.js'))
		;({ Authentication } = await import('./Authentication.js'))
		;({ OidcClient } = await import('./OidcClient.js'))
	})
	after(() => orm.close())
	afterEach(() => mock.restoreAll())

	/** The server as `server.ts` mounts it, a request signed in or not answering whose it is. */
	const serve = async (authentication: AuthenticationType, signedInBefore?: (req: express.Request) => void) => {
		const app = express()
		if (signedInBefore) {
			app.use((req, _res, next) => (signedInBefore(req), next()))
		}
		const { router } = authentication
		if (router) {
			app.use('/auth', router)
		}
		app.use(authentication.middleware)
		app.all('/{*path}', (req, res) => res.json({ user: req.user?.id ?? null }))
		const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
			const listening = app.listen(0, () => resolve(listening))
		})
		const origin = `http://localhost:${(server.address() as AddressInfo).port}`
		after(() => server.close())
		return (path: string, { cookie, method }: { cookie?: string, method?: string } = {}) =>
			fetch(`${origin}${path}`, { method, redirect: 'manual', headers: cookie ? { cookie } : {} })
	}

	const cookiesOf = (response: Response) => new Map(response.headers.getSetCookie().map(line => [line.slice(0, line.indexOf('=')), line]))
	const valueOf = (line: string | undefined) => line && decodeURIComponent(line.slice(line.indexOf('=') + 1, line.indexOf(';')))
	const userOf = async (response: Response) => (await response.json() as { user: string | null }).user

	const signedIn = async (idToken?: string) => {
		const em = orm.em.fork()
		const user = new User({ username: `person-${crypto.randomUUID()}` })
		const { session, token } = Session.issue(user, idToken)
		em.persist([user, session])
		await em.flush()
		return { user, session, cookie: `${Session.cookie}=${token}` }
	}

	describe('in single-user mode', () => {
		it('signs every request in as the one local account', async () => {
			const request = await serve(await Authentication.of(orm.em.fork(), new Environment({})))
			const local = await orm.em.fork().findOneOrFail(User, { username: User.default.username })
			assert.equal(await userOf(await request('/api/entries')), local.id)
		})
	})

	describe('through a provider', () => {
		const oidc = async () => serve(await Authentication.of(orm.em.fork(), new Environment(provider)))

		it('answers the API 401 without a session', async () => {
			const response = await (await oidc())('/api/entries')
			assert.equal(response.status, 401)
		})

		it('sends a page to sign in, keeping where it was', async () => {
			const response = await (await oidc())('/week?date=2026-11-08')
			assert.equal(response.status, 302)
			assert.equal(response.headers.get('location'), `/auth/login?returnTo=${encodeURIComponent('/week?date=2026-11-08')}`)
		})

		it('lets an asset through unsigned, never as anyone', async () => {
			const response = await (await oidc())('/app.js')
			assert.equal(await userOf(response), null)
		})

		it('signs a request in by its session', async () => {
			const { user, cookie } = await signedIn()
			assert.equal(await userOf(await (await oidc())('/api/entries', { cookie })), user.id)
		})

		it('refuses a session that ran out, deleting it and its cookie', async () => {
			const { session, cookie } = await signedIn()
			const em = orm.em.fork()
			await em.nativeUpdate(Session, { id: session.id }, { expiresAt: new Date(Date.now() - 1000) })

			const response = await (await oidc())('/api/entries', { cookie })
			assert.equal(response.status, 401)
			assert.match(cookiesOf(response).get(Session.cookie) ?? '', /Expires=Thu, 01 Jan 1970/)
			assert.equal(await orm.em.fork().findOne(Session, { id: session.id }), null)
		})

		it('refuses a token no session was issued for', async () => {
			const response = await (await oidc())('/api/entries', { cookie: `${Session.cookie}=${'0'.repeat(64)}` })
			assert.equal(response.status, 401)
		})

		it('renews a session past half its lifetime', async () => {
			const { session, cookie } = await signedIn()
			await orm.em.fork().nativeUpdate(Session, { id: session.id }, { expiresAt: new Date(Date.now() + Session.lifetime / 4) })

			const response = await (await oidc())('/api/entries', { cookie })
			assert.ok(cookiesOf(response).has(Session.cookie))
			const renewed = await orm.em.fork().findOneOrFail(Session, { id: session.id })
			assert.ok(renewed.expiresAt.getTime() > Date.now() + Session.lifetime * 0.9)
		})

		it('leaves a request an access token signed in to alone', async () => {
			const { user } = await signedIn()
			const request = await serve(await Authentication.of(orm.em.fork(), new Environment(provider)), req => {
				req.user = user
				req.accessToken = {} as typeof req.accessToken
			})
			assert.equal(await userOf(await request('/api/mcp')), user.id)
		})

		describe('signing in', () => {
			const begin = () => mock.method(OidcClient.prototype, 'authorization', () => Promise.resolve({ url: new URL('https://idp.example.com/authorize?client_id=mitra'), verifier: 'the-verifier', state: 'the-state' }))
			const transitOf = (response: Response) => JSON.parse(Buffer.from(valueOf(cookiesOf(response).get('Mitra.Auth'))!, 'base64url').toString())

			it('carries the PKCE verifier, the state and where to go back to across the provider, in a cookie only /auth reads', async () => {
				begin()
				const response = await (await oidc())(`/auth/login?returnTo=${encodeURIComponent('/week?date=2026-11-08')}`)
				assert.equal(response.status, 302)
				assert.equal(response.headers.get('location'), 'https://idp.example.com/authorize?client_id=mitra')
				const line = cookiesOf(response).get('Mitra.Auth')!
				assert.match(line, /Path=\/auth/)
				assert.match(line, /HttpOnly/)
				assert.match(line, /Secure/)
				assert.match(line, /SameSite=Lax/)
				assert.deepEqual(transitOf(response), { verifier: 'the-verifier', state: 'the-state', returnTo: '/week?date=2026-11-08' })
			})

			it('never goes back anywhere but a path on this site', async () => {
				begin()
				const request = await oidc()
				const returnTo = async (requested: string) => transitOf(await request(`/auth/login?returnTo=${encodeURIComponent(requested)}`)).returnTo
				assert.equal(await returnTo('//evil.example/'), undefined)
				assert.equal(await returnTo('https://evil.example/'), undefined)
				// Browsers read a backslash after the first slash as a second slash.
				assert.equal(await returnTo('/\\evil.example'), undefined)
				assert.equal(await returnTo('evil.example'), '/evil.example')
				assert.equal(await returnTo('https://calendar.example.com/week'), '/week')
			})

			it('starts a session for the provider\'s person, with the verifier and state it began with', async () => {
				const callback = mock.method(OidcClient.prototype, 'callback', () => Promise.resolve({ claims: { sub: 'subject-1', email: 'person@example.com' }, idToken: 'the-id-token' }))
				const transit = Buffer.from(JSON.stringify({ verifier: 'the-verifier', state: 'the-state', returnTo: '/week' })).toString('base64url')
				const request = await oidc()

				const response = await request('/auth/callback?code=the-code&state=the-state', { cookie: `Mitra.Auth=${transit}` })
				assert.equal(response.status, 302)
				assert.equal(response.headers.get('location'), '/week')
				const [currentUrl, verifier, state] = callback.mock.calls[0]!.arguments
				assert.equal(String(currentUrl), 'https://calendar.example.com/auth/callback?code=the-code&state=the-state')
				assert.deepEqual([verifier, state], ['the-verifier', 'the-state'])

				const cookies = cookiesOf(response)
				assert.match(cookies.get('Mitra.Auth')!, /Expires=Thu, 01 Jan 1970/)
				const session = cookies.get(Session.cookie)!
				assert.match(session, /HttpOnly/)
				assert.match(session, /Secure/)
				assert.match(session, /SameSite=Lax/)

				const user = await orm.em.fork().findOneOrFail(User, { identity: { subject: 'subject-1' } })
				assert.equal(await userOf(await request('/api/entries', { cookie: `${Session.cookie}=${valueOf(session)}` })), user.id)
			})

			it('sends a callback without its hand-off back to sign in, asking the provider nothing', async () => {
				const callback = mock.method(OidcClient.prototype, 'callback', () => assert.fail('asked the provider'))
				const response = await (await oidc())('/auth/callback?code=the-code&state=the-state')
				assert.equal(response.headers.get('location'), '/auth/login')
				assert.equal(callback.mock.callCount(), 0)
			})
		})

		it('signs out here and at the provider, naming the session it ends', async () => {
			const endSession = mock.method(OidcClient.prototype, 'endSessionUrl', () => Promise.resolve(new URL('https://idp.example.com/logout')))
			const { session, cookie } = await signedIn('the-id-token')

			const response = await (await oidc())('/auth/logout', { cookie })
			assert.equal(response.headers.get('location'), 'https://idp.example.com/logout')
			assert.deepEqual(endSession.mock.calls[0]!.arguments, ['the-id-token'])
			assert.match(cookiesOf(response).get(Session.cookie)!, /Expires=Thu, 01 Jan 1970/)
			assert.equal(await orm.em.fork().findOne(Session, { id: session.id }), null)
		})
	})

	describe('in a demo', () => {
		const demo = async () => serve(await Authentication.of(orm.em.fork(), new Environment({ ...provider, MITRA_DEMO: 'true' })))

		it('wins over a provider: no sign-in, a sandbox for a new visitor', async () => {
			const request = await demo()
			assert.equal((await request('/auth/login')).status, 200)
			const response = await request('/api/entries')
			assert.ok(cookiesOf(response).has(Session.cookie))
			const user = await orm.em.fork().findOneOrFail(User, { id: (await userOf(response))! })
			assert.match(user.username, /^demo-/)
		})

		it('opens no sandbox for an asset', async () => {
			const response = await (await demo())('/app.js')
			assert.equal(await userOf(response), null)
			assert.equal(cookiesOf(response).has(Session.cookie), false)
		})
	})
})
