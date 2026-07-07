import { embeddable, property } from './orm.js'

/** The subset of OIDC ID-token claims mitra consumes (see {@link Identity.fromClaims}). */
export interface IdentityClaims {
	sub: string
	email?: string
	name?: string
	/** URL of the profile photo (standard `profile`-scope claim). We keep the link, never the bytes —
	 * the browser loads it straight from the provider. */
	picture?: string
}

/**
 * The OIDC identity a {@link User} signs in as (multi-user mode): the `(issuer, subject)` pair that
 * keys it — a subject is only unique within its issuer — plus the display profile the provider vouches
 * for (`email`/`name`/`picture`, refreshed from the ID token on every sign-in). A value object with no
 * lifecycle of its own, embedded into `user` as `oidc_*` columns; absent entirely in single-user mode.
 */
@embeddable()
export class Identity {
	// Nullable at the DB level so a User WITHOUT an identity (single-user mode) leaves every `oidc_*`
	// column NULL. issuer/subject are conceptually required and always set by the factory below —
	// mirroring how Recurrence declares `freq!` nullable yet always populates it.
	@property({ type: 'string', nullable: true }) issuer!: string
	@property({ type: 'string', nullable: true }) subject!: string
	@property({ type: 'string', nullable: true }) email?: string
	@property({ type: 'string', nullable: true }) name?: string
	/** A LINK to the provider-hosted photo, not the image itself. */
	@property({ type: 'string', nullable: true }) picture?: string

	constructor(init?: Partial<Identity>) {
		Object.assign(this, init)
	}

	/** Build an identity from a freshly verified token. */
	static fromClaims(issuer: string, claims: IdentityClaims): Identity {
		return new Identity({ issuer, subject: claims.sub }).applyClaims(claims)
	}

	/** Adopt the profile the identity provider vouches for, keeping prior values where a claim is absent. */
	applyClaims(claims: IdentityClaims): this {
		this.email = claims.email ?? this.email
		this.name = claims.name ?? this.name
		this.picture = claims.picture ?? this.picture
		return this
	}
}
