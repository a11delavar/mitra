import * as client from 'openid-client'
import { createLogger } from '../shared/index.js'

const logger = createLogger('GoogleOAuth')

export interface GoogleOAuthOptions {
	clientId: string
	clientSecret: string
	/** The app's external base URL (MITRA_URL) when configured; otherwise the redirect URI is
	 * derived from each request's own origin — fine for localhost/LAN single-user setups. */
	baseUrl?: URL
}

/**
 * The OAuth 2.0 consent flow that connects a Google account to mitra: Authorization Code + PKCE
 * against Google, run entirely by the BACKEND (routes in integrations.ts) — the same relying-party
 * shape as sign-in (see Oidc.ts), reusing `openid-client` against Google's OIDC metadata. Its sole
 * purpose is to capture a long-lived `refresh_token` (plus the account email as the label), which
 * the {@link GoogleCalendar} integration then feeds to tsdav's OAuth mode for CalDAV access.
 *
 * Deliberately separate from sign-in OIDC: this is a per-user data grant ("let mitra read/write
 * this Google calendar"), not authentication, and it exists in single-user deployments too.
 */
export class GoogleOAuth {
	static readonly issuer = 'https://accounts.google.com'
	/** `openid email` labels the integration with the account's address; `calendar` is the CalDAV grant. */
	static readonly scope = 'openid email https://www.googleapis.com/auth/calendar'

	/**
	 * Google Calendar support switches on when `MITRA_GOOGLE_CLIENT_ID` is set (the add-integration
	 * dialog offers the provider only then). Half-configured fails the boot loudly, like Oidc.fromEnv.
	 */
	static fromEnv(env: NodeJS.ProcessEnv = process.env): GoogleOAuth | undefined {
		const clientId = env.MITRA_GOOGLE_CLIENT_ID
		if (!clientId) {
			return undefined
		}
		const clientSecret = env.MITRA_GOOGLE_CLIENT_SECRET
		if (!clientSecret) {
			throw new Error('MITRA_GOOGLE_CLIENT_ID is set but MITRA_GOOGLE_CLIENT_SECRET is missing')
		}
		return new GoogleOAuth({
			clientId,
			clientSecret,
			baseUrl: env.MITRA_URL ? new URL(env.MITRA_URL) : undefined,
		})
	}

	constructor(readonly options: GoogleOAuthOptions) { }

	/** Cookies are `Secure` only on an https deployment (mirrors Oidc.secure). */
	get secure() {
		return this.options.baseUrl?.protocol === 'https:'
	}

	/** What to register in the Google Cloud console as the OAuth client's redirect URI. */
	redirectUri(requestOrigin: string): string {
		return new URL('/api/integrations/google/callback', this.options.baseUrl ?? requestOrigin).href
	}

	private configuration?: Promise<client.Configuration>

	/** Google's OIDC metadata, discovered lazily and retried on failure (network hiccups at boot
	 * must not poison the cache) — the exact pattern of Oidc.discover. */
	private discover(): Promise<client.Configuration> {
		return this.configuration ??= client.discovery(
			new URL(GoogleOAuth.issuer),
			this.options.clientId,
			this.options.clientSecret,
		).then(configuration => {
			logger.debug('Discovered Google OAuth metadata')
			return configuration
		}).catch(error => {
			this.configuration = undefined
			logger.warn(`Google OAuth discovery failed: ${error instanceof Error ? error.message : error}`)
			throw error
		})
	}

	/** Starts the consent flow. `access_type=offline` + `prompt=consent` make Google issue a refresh
	 * token every time — without the prompt, a re-consent of an already-granted account returns none. */
	async authorization(redirectUri: string): Promise<{ url: URL, verifier: string, state: string }> {
		const configuration = await this.discover()
		const verifier = client.randomPKCECodeVerifier()
		const state = client.randomState()
		const url = client.buildAuthorizationUrl(configuration, {
			redirect_uri: redirectUri,
			scope: GoogleOAuth.scope,
			access_type: 'offline',
			prompt: 'consent',
			code_challenge: await client.calculatePKCECodeChallenge(verifier),
			code_challenge_method: 'S256',
			state,
		})
		return { url, verifier, state }
	}

	/** Finishes the flow: exchanges the code (validating state + PKCE) for the refresh token and the
	 * consenting account's email off the ID token. */
	async callback(currentUrl: URL, verifier: string, state: string): Promise<{ email: string, refreshToken: string }> {
		const configuration = await this.discover()
		const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
			pkceCodeVerifier: verifier,
			expectedState: state,
		})
		const email = tokens.claims()?.email
		if (typeof email !== 'string' || !email) {
			throw new Error('Google returned no account email — the "email" scope was not granted')
		}
		if (!tokens.refresh_token) {
			throw new Error('Google returned no refresh token — retry connecting the account')
		}
		return { email, refreshToken: tokens.refresh_token }
	}
}
