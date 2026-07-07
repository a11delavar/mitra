import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Oidc } from './Oidc.js'

describe('Oidc.fromEnv', () => {
	const configured = {
		MITRA_OIDC_ISSUER: 'https://idp.example.com/realms/home',
		MITRA_OIDC_CLIENT_ID: 'mitra',
		MITRA_URL: 'https://calendar.example.com',
	}

	it('stays off (single-user mode) without an issuer', () => {
		assert.equal(Oidc.fromEnv({}), undefined)
	})

	it('fails the boot loudly when half-configured', () => {
		assert.throws(() => Oidc.fromEnv({ MITRA_OIDC_ISSUER: configured.MITRA_OIDC_ISSUER }), /MITRA_OIDC_CLIENT_ID/)
		assert.throws(() => Oidc.fromEnv({ MITRA_OIDC_ISSUER: configured.MITRA_OIDC_ISSUER, MITRA_OIDC_CLIENT_ID: 'mitra' }), /MITRA_URL/)
	})

	it('derives the redirect URI from the app\'s external URL', () => {
		assert.equal(Oidc.fromEnv(configured)?.redirectUri, 'https://calendar.example.com/auth/callback')
	})

	it('marks cookies Secure only on https deployments', () => {
		assert.equal(Oidc.fromEnv(configured)?.secure, true)
		assert.equal(Oidc.fromEnv({ ...configured, MITRA_URL: 'http://192.168.0.10:3000' })?.secure, false)
	})

	it('defaults the scopes and honors an override', () => {
		assert.equal(Oidc.fromEnv(configured)?.options.scope, 'openid profile email')
		assert.equal(Oidc.fromEnv({ ...configured, MITRA_OIDC_SCOPES: 'openid email' })?.options.scope, 'openid email')
	})

	it('is a public client when no secret is configured', () => {
		assert.equal(Oidc.fromEnv(configured)?.options.clientSecret, undefined)
		assert.equal(Oidc.fromEnv({ ...configured, MITRA_OIDC_CLIENT_SECRET: 'top-secret' })?.options.clientSecret, 'top-secret')
	})
})
