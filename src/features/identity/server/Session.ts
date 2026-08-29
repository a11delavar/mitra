import { createHash, randomBytes } from 'node:crypto'
import { User } from '../User.js'
import { entity, primaryKey, property, manyToOne } from '../../../infrastructure/model/orm.js'

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

	@primaryKey({ type: 'string' }) id!: string
	@manyToOne(() => User, { mapToPk: true, deleteRule: 'cascade' }) userId!: string
	@property({ type: 'datetime' }) expiresAt!: Date
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
