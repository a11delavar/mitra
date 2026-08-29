import * as client from 'openid-client'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { type IdentityClaims } from '../Identity.js'
const logger = createLogger('OIDC')

export interface OidcOptions {
	issuer: string
	clientId: string
	clientSecret?: string
	baseUrl: URL
	scope: string
}

/**
 * OpenID Connect relying party client handling Authorization Code + PKCE flows.
 */
export class Oidc {
	/** Creates an OIDC client from environment variables, returning undefined in single-user mode. */
	static fromEnv(env: NodeJS.ProcessEnv = process.env): Oidc | undefined {
		const issuer = env.MITRA_OIDC_ISSUER
		if (!issuer) {
			return undefined
		}
		const clientId = env.MITRA_OIDC_CLIENT_ID
		const url = env.MITRA_URL
		if (!clientId) {
			throw new Error('MITRA_OIDC_ISSUER is set but MITRA_OIDC_CLIENT_ID is missing')
		}
		if (!url) {
			throw new Error('MITRA_OIDC_ISSUER is set but MITRA_URL (the app\'s external URL, e.g. https://mitra.example.com) is missing')
		}
		return new Oidc({
			issuer,
			clientId,
			clientSecret: env.MITRA_OIDC_CLIENT_SECRET || undefined,
			baseUrl: new URL(url),
			scope: env.MITRA_OIDC_SCOPES || 'openid profile email',
		})
	}

	constructor(readonly options: OidcOptions) { }

	get issuer() {
		return this.options.issuer
	}

	get baseUrl() {
		return this.options.baseUrl
	}

	get secure() {
		return this.baseUrl.protocol === 'https:'
	}

	get redirectUri() {
		return new URL('/auth/callback', this.baseUrl).href
	}

	private configuration?: Promise<client.Configuration>

	private discover(): Promise<client.Configuration> {
		return this.configuration ??= client.discovery(
			new URL(this.options.issuer),
			this.options.clientId,
			this.options.clientSecret,
			this.options.clientSecret ? undefined : client.None(),
			new URL(this.options.issuer).protocol === 'http:' ? { execute: [client.allowInsecureRequests] } : undefined,
		).then(configuration => {
			logger.debug(`Discovered OIDC metadata for ${this.options.issuer}`)
			return configuration
		}).catch(error => {
			this.configuration = undefined
			logger.warn(`OIDC discovery failed for ${this.options.issuer}: ${error instanceof Error ? error.message : error}`)
			throw error
		})
	}

	/** Starts the authorization code flow returning redirect URL, PKCE verifier, and state. */
	async authorization(): Promise<{ url: URL, verifier: string, state: string }> {
		const configuration = await this.discover()
		const verifier = client.randomPKCECodeVerifier()
		const state = client.randomState()
		const url = client.buildAuthorizationUrl(configuration, {
			redirect_uri: this.redirectUri,
			scope: this.options.scope,
			code_challenge: await client.calculatePKCECodeChallenge(verifier),
			code_challenge_method: 'S256',
			state,
		})
		return { url, verifier, state }
	}

	/** Exchanges the authorization code for tokens and extracts verified user identity claims. */
	async callback(currentUrl: URL, verifier: string, state: string): Promise<{ claims: IdentityClaims, idToken?: string }> {
		const configuration = await this.discover()
		const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
			pkceCodeVerifier: verifier,
			expectedState: state,
		})
		const claims = tokens.claims()
		if (!claims?.sub) {
			throw new Error('The identity provider returned no ID token subject')
		}
		return {
			claims: {
				sub: claims.sub,
				email: typeof claims.email === 'string' ? claims.email : undefined,
				name: typeof claims.name === 'string' ? claims.name : undefined,
				picture: typeof claims.picture === 'string' ? claims.picture : undefined,
			},
			idToken: tokens.id_token,
		}
	}

	/** Builds the RP-initiated logout URL if supported by the provider. */
	async endSessionUrl(idToken?: string): Promise<URL | undefined> {
		try {
			const configuration = await this.discover()
			if (!configuration.serverMetadata().end_session_endpoint) {
				return undefined
			}
			return client.buildEndSessionUrl(configuration, {
				...(idToken ? { id_token_hint: idToken } : {}),
				post_logout_redirect_uri: this.baseUrl.href,
			})
		} catch {
			return undefined
		}
	}
}
