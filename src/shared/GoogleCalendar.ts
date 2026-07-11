import { type createDAVClient } from 'tsdav'
import { model } from './model.js'
import { CalDAV } from './CalDAV.js'
import { integration } from './Integration.js'

export interface GoogleCalendarCredentials {
	/** The Google account's email — the integration's label (what the sidebar shows as its title). */
	username: string
	/** The long-lived OAuth grant captured by the backend's consent flow (backend/GoogleOAuth.ts).
	 * tsdav exchanges it for short-lived access tokens on its own; mitra never talks to Google's
	 * token endpoint directly after the initial code exchange. */
	refreshToken: string
}

/**
 * Google Calendar, spoken over Google's CalDAV v2 endpoint — the entire sync/CRUD engine is the
 * inherited {@link CalDAV} implementation; only authentication differs. Google retired Basic auth,
 * so instead of a username/password this integration carries an OAuth `refreshToken` (obtained via
 * the consent flow in backend/GoogleOAuth.ts) and hands it to tsdav's `Oauth` mode, which mints and
 * refreshes the Bearer tokens itself against Google's token endpoint.
 *
 * Deployment-level configuration (the Google Cloud OAuth client) comes from the environment:
 * `MITRA_GOOGLE_CLIENT_ID` + `MITRA_GOOGLE_CLIENT_SECRET`. Only ever read server-side — the
 * frontend uses this class purely as an API model.
 */
@model('GoogleCalendar')
@integration('google')
export class GoogleCalendar extends CalDAV {
	/** Google's CalDAV v2 root; account discovery resolves the per-account home from here. */
	static readonly serverUrl = 'https://apidata.googleusercontent.com/caldav/v2/'
	static readonly tokenUrl = 'https://oauth2.googleapis.com/token'

	/** The per-account calendar home. Stored as the integration's `uri` — informative, and what lets
	 * the `(userId, uri)` unique constraint distinguish two connected Google accounts (a reconnect of
	 * the same account updates in place instead of duplicating). */
	static uriFor(email: string): string {
		return new URL(`${encodeURIComponent(email)}/`, GoogleCalendar.serverUrl).href
	}

	declare credentials: GoogleCalendarCredentials

	constructor(init?: Partial<GoogleCalendar>) {
		super()
		Object.assign(this, init)
	}

	// A fixed label, not `this.type`: MikroORM doesn't back-populate the STI discriminator onto a
	// freshly-constructed instance until it's reloaded, so `this.type` reads `undefined` right after create.
	override toString() {
		return `Google Calendar integration for "${this.credentials.username}"`
	}

	/** Nothing is form-editable: the account and its grant come exclusively from the OAuth consent
	 * flow (a reconnect goes through it again), so an "edit" only re-selects sources. */
	override merge(_incoming: this) { }

	protected override get editableCredentials(): GoogleCalendarCredentials {
		return { username: this.credentials.username, refreshToken: '' }
	}

	/** Google enforces per-user API quotas (403/429 beyond them). The incremental sync-token REPORTs
	 * are cheap, but the synchronizer's every-cycle cadence would still poll needlessly hard — and each
	 * cycle also mints a fresh access token. One poll a minute is plenty for a push-less protocol. */
	override get syncInterval() { return 60_000 }

	protected override get clientParameters(): Parameters<typeof createDAVClient>[0] {
		const clientId = process.env.MITRA_GOOGLE_CLIENT_ID
		const clientSecret = process.env.MITRA_GOOGLE_CLIENT_SECRET
		if (!clientId || !clientSecret) {
			throw new Error('Google Calendar requires MITRA_GOOGLE_CLIENT_ID and MITRA_GOOGLE_CLIENT_SECRET to be configured')
		}
		return {
			defaultAccountType: 'caldav',
			authMethod: 'Oauth',
			serverUrl: GoogleCalendar.serverUrl,
			// A copy on purpose: tsdav mutates the passed object with the minted access token, and the
			// client id/secret must never bleed into the persisted credentials column. The token cache is
			// thus per-client — one refresh per sync cycle, well within Google's token endpoint limits.
			credentials: {
				tokenUrl: GoogleCalendar.tokenUrl,
				username: this.credentials.username,
				refreshToken: this.credentials.refreshToken,
				clientId,
				clientSecret,
			},
		}
	}

	/** The refresh token is a server-side secret: what the API serves (and the dialog round-trips)
	 * carries only the account label. `merge` ignores incoming credentials anyway. */
	toJSON() {
		return { ...this, client: undefined, credentials: { username: this.credentials.username } }
	}
}
