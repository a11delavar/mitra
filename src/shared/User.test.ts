import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { EntityManager } from '@mikro-orm/core'
import { User } from './User.js'
import { Identity } from './Identity.js'

const ISSUER = 'https://idp.example.com/realms/home'

/** Just enough of an EntityManager for User.provision: findOne by the embedded (issuer, subject),
 * persist into the backing array. */
function fakeEm(users: Array<User>): EntityManager {
	return {
		findOne: (_type: unknown, where: { identity?: { issuer?: string, subject?: unknown } }) =>
			Promise.resolve(users.find(user =>
				user.identity?.issuer === where.identity?.issuer && user.identity?.subject === where.identity?.subject) ?? null),
		persist: (user: User) => void users.push(user),
	} as unknown as EntityManager
}

describe('User', () => {
	describe('provision', () => {
		it('resolves an existing identity and refreshes its profile', async () => {
			const existing = new User({ username: 'subject-1', identity: Identity.fromClaims(ISSUER, { sub: 'subject-1', name: 'Old Name' }) })
			const users = [existing]
			const provisioned = await User.provision(fakeEm(users), ISSUER, { sub: 'subject-1', name: 'New Name' })
			assert.equal(provisioned, existing)
			assert.equal(provisioned.identity?.name, 'New Name')
			assert.equal(users.length, 1)
		})

		it('creates a fresh user on first sight — never claiming a pre-auth default user', async () => {
			const preAuth = new User({ username: User.default.username })
			const users = [preAuth]
			const provisioned = await User.provision(fakeEm(users), ISSUER, { sub: 'subject-1', email: 'operator@example.com', name: 'Operator' })
			assert.notEqual(provisioned, preAuth)
			assert.equal(provisioned.identity?.subject, 'subject-1')
			assert.equal(provisioned.identity?.issuer, ISSUER)
			assert.equal(provisioned.username, 'subject-1')
			assert.equal(provisioned.identity?.email, 'operator@example.com')
			assert.equal(provisioned.identity?.name, 'Operator')
			assert.equal(users.length, 2)
		})

		it('creates distinct users for distinct identities', async () => {
			const users = new Array<User>()
			const first = await User.provision(fakeEm(users), ISSUER, { sub: 'subject-1' })
			const second = await User.provision(fakeEm(users), ISSUER, { sub: 'subject-2' })
			assert.notEqual(first, second)
			assert.equal(users.length, 2)
		})
	})
})
