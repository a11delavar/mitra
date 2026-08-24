import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GoogleOAuth } from './GoogleOAuth.js'

describe('GoogleOAuth.fromEnv', () => {
	const configured = {
		MITRA_GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
		MITRA_GOOGLE_CLIENT_SECRET: 'client-secret',
	}

	it('stays off (no Google provider offered) without a client id', () => {
		assert.equal(GoogleOAuth.fromEnv({}), undefined)
	})

	it('fails the boot loudly when half-configured', () => {
		assert.throws(() => GoogleOAuth.fromEnv({ MITRA_GOOGLE_CLIENT_ID: configured.MITRA_GOOGLE_CLIENT_ID }), /MITRA_GOOGLE_CLIENT_SECRET/)
	})

	it('derives the redirect URI from the app\'s external URL when configured', () => {
		const google = GoogleOAuth.fromEnv({ ...configured, MITRA_URL: 'https://mitra.example.com' })
		assert.equal(google?.redirectUri('http://internal:3000'), 'https://mitra.example.com/api/integrations/google/callback')
	})

	it('falls back to the request\'s own origin without MITRA_URL (localhost single-user)', () => {
		const google = GoogleOAuth.fromEnv(configured)
		assert.equal(google?.redirectUri('http://localhost:3000'), 'http://localhost:3000/api/integrations/google/callback')
	})

	it('marks the transit cookie Secure only on https deployments', () => {
		assert.equal(GoogleOAuth.fromEnv({ ...configured, MITRA_URL: 'https://mitra.example.com' })?.secure, true)
		assert.equal(GoogleOAuth.fromEnv(configured)?.secure, false)
	})

	it('requests the calendar grant alongside the identifying email', () => {
		assert.match(GoogleOAuth.scope, /https:\/\/www\.googleapis\.com\/auth\/calendar/)
		assert.match(GoogleOAuth.scope, /email/)
	})
})
