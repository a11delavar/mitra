import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Identity } from './Identity.js'

const ISSUER = 'https://idp.example.com/realms/home'

describe('Identity', () => {
	describe('fromClaims', () => {
		it('keys on issuer + subject and adopts the profile', () => {
			const identity = Identity.fromClaims(ISSUER, { sub: 'subject-1', email: 'me@example.com', name: 'Me', picture: 'https://idp.example.com/me.png' })
			assert.equal(identity.issuer, ISSUER)
			assert.equal(identity.subject, 'subject-1')
			assert.equal(identity.email, 'me@example.com')
			assert.equal(identity.name, 'Me')
			assert.equal(identity.picture, 'https://idp.example.com/me.png')
		})
	})

	describe('applyClaims', () => {
		it('adopts the vouched profile', () => {
			const identity = new Identity({ issuer: ISSUER, subject: 'subject-1' })
			identity.applyClaims({ sub: 'subject-1', email: 'me@example.com', name: 'Me', picture: 'https://idp.example.com/me.png' })
			assert.equal(identity.email, 'me@example.com')
			assert.equal(identity.name, 'Me')
			assert.equal(identity.picture, 'https://idp.example.com/me.png')
		})

		it('keeps prior values where a claim is absent', () => {
			const identity = new Identity({ issuer: ISSUER, subject: 'subject-1', email: 'me@example.com', name: 'Me', picture: 'https://idp.example.com/me.png' })
			identity.applyClaims({ sub: 'subject-1' })
			assert.equal(identity.email, 'me@example.com')
			assert.equal(identity.name, 'Me')
			assert.equal(identity.picture, 'https://idp.example.com/me.png')
		})
	})
})
