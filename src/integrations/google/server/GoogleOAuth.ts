import * as client from 'openid-client'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
const logger = createLogger('GoogleOAuth')

export interface GoogleOAuthOptions {
	clientId: string
	clientSecret: string
	baseUrl?: URL
}

/** OAuth 2.0 PKCE flow for connecting a Google Calendar account. */
export class GoogleOAuth {
	static readonly issuer = 'https://accounts.google.com'
	static readonly scope = 'openid email https://www.googleapis.com/auth/calendar'

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

	get secure() {
		return this.options.baseUrl?.protocol === 'https:'
	}

	redirectUri(requestOrigin: string): string {
		return new URL('/api/integrations/google/callback', this.options.baseUrl ?? requestOrigin).href
	}

	private configuration?: Promise<client.Configuration>

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

	/** Starts the authorization flow with offline access and PKCE. */
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

	/** Exchanges authorization code for refresh token and user email. */
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
