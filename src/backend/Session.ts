import { createHash, randomBytes } from 'node:crypto'
import { entity, primaryKey, property, manyToOne, User } from '../shared/index.js'

/**
 * A signed-in browser (multi-user mode). The HttpOnly cookie holds a random 256-bit bearer token;
 * the row's id is only its SHA-256 digest, so a leaked database dump contains nothing that opens a
 * live session. The identity provider's tokens are deliberately NOT kept alive here — mitra calls no
 * upstream APIs on the user's behalf, so a session's validity is purely its own sliding expiry (only
 * the raw id_token is retained, as the `id_token_hint` for RP-initiated logout).
 */
@entity()
export class Session {
	static readonly cookie = 'mitra-session'

	/** How long a session lives without renewal. */
	static readonly lifetime = 30 * 24 * 60 * 60 * 1000

	/** Mints a session: the returned `token` goes into the cookie; only its digest is persisted. */
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

	/** Sliding expiry: past the halfway point, the next authenticated request extends the session. */
	get shouldRenew(): boolean {
		return this.expiresAt.getTime() - Date.now() < Session.lifetime / 2
	}

	renew() {
		this.expiresAt = new Date(Date.now() + Session.lifetime)
	}
}
