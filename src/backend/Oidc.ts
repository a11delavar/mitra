import * as client from 'openid-client'
import type { IdentityClaims } from '../shared/index.js'

export interface OidcOptions {
	issuer: string
	clientId: string
	/** Absent for a public client — PKCE (always on) is then the sole proof of possession. */
	clientSecret?: string
	/** The app's external base URL — the redirect URI and cookie security derive from it. */
	baseUrl: URL
	scope: string
}

/**
 * The OpenID Connect relying party (multi-user mode): mitra's BACKEND runs the Authorization Code +
 * PKCE flow and hands the browser nothing but an opaque session cookie (see Session.ts) — no token
 * ever reaches frontend storage, and the same-origin SPA needs no auth library at all. Configured
 * entirely via environment variables; see {@link Oidc.fromEnv}.
 */
export class Oidc {
	/**
	 * OIDC switches on when `MITRA_OIDC_ISSUER` is set; without it the deployment stays zero-auth
	 * single-user. A half-configured issuer fails the boot loudly — a calendar silently falling back
	 * to no authentication would be far worse than not starting.
	 */
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

	/** Cookies are `Secure` only when the app is actually served over https — a plain-http LAN deployment would otherwise lose them. */
	get secure() {
		return this.baseUrl.protocol === 'https:'
	}

	/** What to register at the identity provider. */
	get redirectUri() {
		return new URL('/auth/callback', this.baseUrl).href
	}

	private configuration?: Promise<client.Configuration>

	/** Discovers (and caches) the IdP's metadata lazily: in a compose stack the IdP may well boot
	 * after mitra, so a failed discovery must retry on the next sign-in instead of poisoning the cache. */
	private discover(): Promise<client.Configuration> {
		return this.configuration ??= client.discovery(
			new URL(this.options.issuer),
			this.options.clientId,
			this.options.clientSecret,
			this.options.clientSecret ? undefined : client.None(),
			// An http issuer is allowed deliberately: a LAN self-host or compose-internal IdP has no TLS.
			new URL(this.options.issuer).protocol === 'http:' ? { execute: [client.allowInsecureRequests] } : undefined,
		).catch(error => {
			this.configuration = undefined
			throw error
		})
	}

	/** Starts the code flow: the returned `verifier`/`state` round-trip via a short-lived cookie. */
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

	/** Finishes the code flow: exchanges the code, validating state, PKCE and the ID token. */
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

	/** The RP-initiated logout URL, where the IdP offers one — ends the SSO session too, not just ours. */
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
			return undefined // signing out locally must not fail because the IdP is unreachable
		}
	}
}
