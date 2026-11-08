import { createHash, randomBytes } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/sqlite'
import { createLogger } from '#infrastructure/logging/Logger.js'
import type { Environment } from '#infrastructure/server/Environment.js'
import { entity, primaryKey, property, manyToOne } from '#infrastructure/model'
import { User } from '../User.js'
import { Cookie } from './Cookie.js'

/**
 * Represents an authenticated user session stored by token SHA-256 hash.
 */
@entity()
export class Session {
	static readonly cookie = 'mitra-session'
	static readonly lifetime = 30 * 24 * 60 * 60 * 1000

	/** Mints a session returning the cookie token and the hashed session record. */
	static issue(user: User, idToken?: string): { session: Session, token: string } {
		const token = randomBytes(32).toString('base64url')
		const session = new Session({
			id: Session.idFor(token),
			userId: user.id,
			expiresAt: new Date(Date.now() + Session.lifetime),
			idToken,
		})
		return { session, token }
	}

	static idFor(token: string): string {
		return createHash('sha256').update(token).digest('hex')
	}

	/** The session `token` names, whatever state it is in. */
	static of(em: EntityManager, token: string) {
		return em.findOne(Session, { id: Session.idFor(token) })
	}

	/** The cookie carrying a session's token, secure where the instance is served over HTTPS. */
	static cookieFor(environment: Environment) {
		return new Cookie(Session.cookie, { httpOnly: true, sameSite: 'lax', secure: environment.url?.protocol === 'https:', maxAge: Session.lifetime, path: '/' })
	}

	/** Deletes the sessions that ran out, as the server starts. */
	static async sweep(em: EntityManager) {
		const swept = await em.nativeDelete(Session, { expiresAt: { $lt: new Date() } })
		if (swept) {
			createLogger('Auth').debug(`Swept ${swept} expired session(s) at boot`)
		}
	}

	@primaryKey({ type: 'string' }) id!: string
	@manyToOne(() => User, { mapToPk: true, deleteRule: 'cascade' }) userId!: string
	@property({ type: 'Date' }) expiresAt!: Date
	@property({ type: 'text', nullable: true }) idToken?: string

	constructor(init?: Partial<Session>) {
		Object.assign(this, init)
	}

	get expired(): boolean {
		return this.expiresAt.getTime() <= Date.now()
	}

	get shouldRenew(): boolean {
		return this.expiresAt.getTime() - Date.now() < Session.lifetime / 2
	}

	renew() {
		this.expiresAt = new Date(Date.now() + Session.lifetime)
	}
}
