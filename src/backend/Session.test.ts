import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Session } from './Session.js'
import { User } from '../shared/index.js'

describe('Session', () => {
	const user = new User({ username: 'session-owner' })

	describe('issue', () => {
		it('links the user and stores only the token\'s digest', () => {
			const { session, token } = Session.issue(user)
			assert.equal(session.userId, user.id)
			assert.equal(session.id, Session.idFor(token))
			assert.notEqual(session.id, token)
		})

		it('mints a fresh token every time', () => {
			assert.notEqual(Session.issue(user).token, Session.issue(user).token)
		})

		it('starts neither expired nor due for renewal', () => {
			const { session } = Session.issue(user)
			assert.equal(session.expired, false)
			assert.equal(session.shouldRenew, false)
		})

		it('keeps the id_token for the logout hint', () => {
			assert.equal(Session.issue(user, 'id-token').session.idToken, 'id-token')
		})
	})

	describe('idFor', () => {
		it('is deterministic', () => {
			assert.equal(Session.idFor('token'), Session.idFor('token'))
			assert.notEqual(Session.idFor('token'), Session.idFor('other'))
		})
	})

	describe('expiry', () => {
		it('expires at its deadline', () => {
			assert.equal(new Session({ expiresAt: new Date(Date.now() - 1) }).expired, true)
			assert.equal(new Session({ expiresAt: new Date(Date.now() + 60_000) }).expired, false)
		})

		it('wants renewal once past the halfway point', () => {
			assert.equal(new Session({ expiresAt: new Date(Date.now() + Session.lifetime / 2 - 60_000) }).shouldRenew, true)
			assert.equal(new Session({ expiresAt: new Date(Date.now() + Session.lifetime / 2 + 60_000) }).shouldRenew, false)
		})

		it('renew extends the full lifetime again', () => {
			const session = new Session({ expiresAt: new Date(Date.now() + 60_000) })
			session.renew()
			assert.equal(session.expired, false)
			assert.equal(session.shouldRenew, false)
		})
	})
})
