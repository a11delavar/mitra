import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { EntityManager } from '@mikro-orm/core'
import { User } from './User.js'
import { Identity } from './Identity.js'
import { Source } from '../sources/Source.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

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

	// "Only show this calendar" and its way back. The record is the complement — what was hidden — and
	// these pin what that buys: a calendar appearing mid-solo comes back shown.
	describe('showOnly / restorePreviousVisibility', () => {
		const sourcesOf = (...hidden: Array<boolean>) => hidden.map((isHidden, index) =>
			new Source({ id: `s${index}`, integrationId: 'i', uri: `dev://s${index}`, name: `s${index}`, enabled: true, hidden: isHidden }))
		const hiddenOf = (sources: Array<Source>) => sources.map(source => source.hidden)

		it('leaves only the chosen calendar on show, and records what was hidden', () => {
			const user = new User({ username: 'u' })
			const sources = sourcesOf(false, false, true)
			user.showOnly(sources, 's0')
			assert.deepEqual(hiddenOf(sources), [false, true, true])
			assert.deepEqual(user.previouslyHiddenSourceIds, ['s2'])
		})

		it('records an EMPTY list when nothing was hidden — which still means "soloed"', () => {
			const user = new User({ username: 'u' })
			user.showOnly(sourcesOf(false, false), 's0')
			assert.deepEqual(user.previouslyHiddenSourceIds, [])
		})

		it('keeps the original record when hopping from one solo to the next', () => {
			const user = new User({ username: 'u' })
			const sources = sourcesOf(false, false, true)
			user.showOnly(sources, 's0')
			user.showOnly(sources, 's1')
			assert.deepEqual(hiddenOf(sources), [true, false, true])
			// Not ['s0', 's2'] — the second hop must not record the first hop's solo as the way back.
			assert.deepEqual(user.previouslyHiddenSourceIds, ['s2'])
		})

		it('records nothing when the chosen calendar is already the only one shown', () => {
			const user = new User({ username: 'u' })
			user.showOnly(sourcesOf(false, true), 's0')
			assert.equal(user.previouslyHiddenSourceIds, undefined)
		})

		it('comes back to the visibility from before the solo, and spends the record', () => {
			const user = new User({ username: 'u' })
			const sources = sourcesOf(false, false, true)
			user.showOnly(sources, 's0')
			user.restorePreviousVisibility(sources)
			assert.deepEqual(hiddenOf(sources), [false, false, true])
			assert.equal(user.previouslyHiddenSourceIds, undefined)
		})

		it('brings a calendar that appeared mid-solo back SHOWN — no record ever knew of it', () => {
			const user = new User({ username: 'u' })
			const sources = sourcesOf(false, false, true)
			user.showOnly(sources, 's0')
			const fresh = new Source({ id: 'fresh', integrationId: 'i', uri: 'dev://fresh', name: 'fresh', enabled: true, hidden: false })
			sources.push(fresh)
			user.restorePreviousVisibility(sources)
			assert.equal(fresh.hidden, false)
			// s2 goes back to hidden; the newcomer keeps the visibility it was created with.
			assert.deepEqual(hiddenOf(sources), [false, false, true, false])
		})
	})

	// The restore rests on presence vs. emptiness, so the wire must keep them apart: an empty list
	// arriving as undefined would leave the user soloed with no offer to come back.
	describe('previouslyHiddenSourceIds', () => {
		const round = (ids: Array<string> | undefined) => revive<User>(wireOf(new User({ username: 'u', previouslyHiddenSourceIds: ids }))).previouslyHiddenSourceIds

		it('keeps an empty list distinct from an absent one', () => {
			assert.deepEqual(round([]), [])
			assert.equal(round(undefined), undefined)
		})

		it('carries the recorded ids', () => {
			assert.deepEqual(round(['a', 'b']), ['a', 'b'])
		})
	})
})
