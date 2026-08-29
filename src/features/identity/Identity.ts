import { embeddable, property } from '../../infrastructure/model/orm.js'

export interface IdentityClaims {
	sub: string
	email?: string
	name?: string
	picture?: string
}

/**
 * Value object representing a user's federated OIDC identity (issuer, subject, and profile claims).
 * Embedded into User in multi-user mode.
 */
@embeddable()
export class Identity {
	@property({ type: 'string', nullable: true }) issuer!: string
	@property({ type: 'string', nullable: true }) subject!: string
	@property({ type: 'string', nullable: true }) email?: string
	@property({ type: 'string', nullable: true }) name?: string
	@property({ type: 'string', nullable: true }) picture?: string

	constructor(init?: Partial<Identity>) {
		Object.assign(this, init)
	}

	/** Builds an Identity from verified OIDC token claims. */
	static fromClaims(issuer: string, claims: IdentityClaims): Identity {
		return new Identity({ issuer, subject: claims.sub }).applyClaims(claims)
	}

	/** Adopts profile claims from the identity provider, retaining existing values for absent claims. */
	applyClaims(claims: IdentityClaims): this {
		this.email = claims.email ?? this.email
		this.name = claims.name ?? this.name
		this.picture = claims.picture ?? this.picture
		return this
	}
}
