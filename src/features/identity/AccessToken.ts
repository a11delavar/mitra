import { converter } from '@a11d/converter'
import { User } from './User.js'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, enum as enumType, manyToOne } from '../../infrastructure/model/orm.js'
import { withheld } from '../../infrastructure/model/withheld.js'

/** What an access token lets an agent do: read, or read and write. */
export enum AccessTokenScope {
	Read = 'read',
	Write = 'write',
}

/**
 * A token a person gives an agent to reach their calendars where people sign in, stored by its SHA-256 hash, so the token
 * itself is seen once, when it is made. It holds until revoked.
 */
@model('AccessToken')
@entity()
export class AccessToken {
	/** What every token starts with, so a secret scanner can tell one from other secrets. */
	static readonly prefix = 'mitra_'

	/** A new token for `user`: the record to keep, and the token to show once. */
	static async issue(user: User, name: string, scope: AccessTokenScope) {
		const token = `${AccessToken.prefix}${AccessToken.hexOf(crypto.getRandomValues(new Uint8Array(32)))}`
		const accessToken = new AccessToken({ id: crypto.randomUUID(), hash: await AccessToken.hashOf(token), userId: user.id, name, scope, createdAt: new Date() })
		return { accessToken, token }
	}

	static async hashOf(token: string) {
		return AccessToken.hexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
	}

	private static hexOf(bytes: Uint8Array) {
		return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
	}

	@primaryKey({ type: 'string' }) id!: string

	@property({ type: 'string', unique: true })
	@converter(withheld()) hash!: string

	@manyToOne(() => User, { mapToPk: true, deleteRule: 'cascade' }) userId!: string
	@property({ type: 'string' }) name!: string
	@enumType({ items: () => AccessTokenScope }) scope!: AccessTokenScope
	@property({ type: 'Date' }) createdAt!: Date
	@property({ type: 'Date', nullable: true }) lastUsedAt?: Date

	constructor(init?: Partial<AccessToken>) {
		Object.assign(this, init)
	}

	get writes() {
		return this.scope === AccessTokenScope.Write
	}

	/** Notes a use, at most once a minute, so an agent calling often does not write on every call. Answers whether it noted one. */
	use(now = new Date()) {
		if (this.lastUsedAt && now.getTime() - this.lastUsedAt.getTime() < 60_000) {
			return false
		}
		this.lastUsedAt = now
		return true
	}
}
