import { type createDAVClient } from 'tsdav'
import { converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { CalDAV } from '../caldav/CalDAV.js'
import { integration, withheld } from '../Integration.js'

export interface GoogleCalendarCredentials {
	/** The Google account's email — the integration's label (what the sidebar shows as its title). */
	username: string
	/** The long-lived OAuth grant captured by the backend's consent flow (integrations/google/server/GoogleOAuth.ts).
	 * tsdav exchanges it for short-lived access tokens on its own; mitra never talks to Google's
	 * token endpoint directly after the initial code exchange. */
	refreshToken: string
}

/**
 * Google Calendar, spoken over Google's CalDAV v2 endpoint — the entire sync/CRUD engine is the
 * inherited {@link CalDAV} implementation; only authentication differs. Google retired Basic auth,
 * so instead of a username/password this integration carries an OAuth `refreshToken` (obtained via
 * the consent flow in integrations/google/server/GoogleOAuth.ts) and hands it to tsdav's `Oauth` mode, which mints and
 * refreshes the Bearer tokens itself against Google's token endpoint.
 *
 * Deployment-level configuration (the Google Cloud OAuth client) comes from the environment:
 * `MITRA_GOOGLE_CLIENT_ID` + `MITRA_GOOGLE_CLIENT_SECRET`. Only ever read server-side — the
 * frontend uses this class purely as an API model.
 */
@model('GoogleCalendar')
@integration('google')
export class GoogleCalendar extends CalDAV {
	static override readonly label: string = 'Google Calendar'
	static override readonly logo: string = 'google'
	static override readonly description: string = 'The calendars of your Google account'

	/** Google's CalDAV v2 root; account discovery resolves the per-account home from here. */
	static readonly serverUrl = 'https://apidata.googleusercontent.com/caldav/v2/'
	static readonly tokenUrl = 'https://oauth2.googleapis.com/token'

	/** The per-account calendar home. Stored as the integration's `uri` — informative, and what lets
	 * the `(userId, uri)` unique constraint distinguish two connected Google accounts (a reconnect of
	 * the same account updates in place instead of duplicating). */
	static uriFor(email: string): string {
		return new URL(`${encodeURIComponent(email)}/`, GoogleCalendar.serverUrl).href
	}

	/**
	 * The one place the inherited CalDAV engine is not enough. Google's CalDAV v2 is a FAÇADE over
	 * Google's own event model, which has no concept of one event relating to another, so it
	 * regenerates the `.ics` without the `RELATED-TO` mitra wrote — the same regeneration that drops
	 * `X-` properties. Accepting a write and returning it missing is not a store, and the sync's
	 * DEFINITE parse read that absence as a removal: reported and reproduced in the app as a link
	 * vanishing seconds after it was saved.
	 *
	 * So it is declared where every unsupported fact is declared, and it gates the same two things:
	 * the editor offers no way to author one here, and the sync claims no authority (see
	 * {@link Integration.capabilities}).
	 */
	override get capabilities() {
		return { ...super.capabilities, relations: false, percentComplete: false }
	}

	/** The OAuth grant authorizes the account; the e-mail identifies it. */
	@converter(withheld<GoogleCalendarCredentials>('refreshToken')) override credentials!: GoogleCalendarCredentials

	constructor(init?: Partial<GoogleCalendar>) {
		super()
		// This provider's own blank credential shape (CalDAV's super seeded its username/password one).
		this.credentials = { username: '', refreshToken: '' }
		Object.assign(this, init)
	}

	// A human label, not the bare `this.type` discriminator ('google').
	override toString() {
		return `Google Calendar integration for "${this.credentials.username}"`
	}

	/** Nothing is form-editable: the account and its grant come exclusively from the OAuth consent
	 * flow (a reconnect goes through it again), so an "edit" only re-selects sources. */
	override merge(_incoming: CalDAV) { }

	/** Google enforces per-user API quotas (403/429 beyond them). The incremental sync-token REPORTs
	 * are cheap, but the synchronizer's every-cycle cadence would still poll needlessly hard — and each
	 * cycle also mints a fresh access token. One poll a minute is plenty for a push-less protocol. */
	override get syncInterval() { return 60_000 }

	override get clientParameters(): Parameters<typeof createDAVClient>[0] {
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

}
