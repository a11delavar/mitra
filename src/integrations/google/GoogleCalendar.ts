import { type createDAVClient } from 'tsdav'
import { converter } from '@a11d/converter'
import { CalDAV } from '#integrations/caldav/CalDAV.js'
import { integration } from '#integrations'
import { model, withheld } from '#infrastructure/model'

export interface GoogleCalendarCredentials {
	/** Google account email. */
	username: string
	/** OAuth refresh token. */
	refreshToken: string
}

/** Google Calendar integration using CalDAV with OAuth refresh tokens. */
@model('GoogleCalendar')
@integration('google')
export class GoogleCalendar extends CalDAV {
	static override readonly label: string = 'Google Calendar'
	static override readonly docs: string | undefined = 'integrations/google'
	static override readonly logo: string = 'google'
	static override readonly description: string = 'The calendars of your Google account'

	static readonly serverUrl = 'https://apidata.googleusercontent.com/caldav/v2/'
	static readonly tokenUrl = 'https://oauth2.googleapis.com/token'

	static uriFor(email: string): string {
		return new URL(`${encodeURIComponent(email)}/`, GoogleCalendar.serverUrl).href
	}

	/** Google drops `RELATED-TO` and `X-` properties from its copy of an event. */
	override get ownership() {
		return super.ownership.without('relations', 'percentComplete')
	}

	/**
	 * Google sends its Drive attachments as `ATTACH` lines but drops any a client writes (probed 2026-10-17), and a read that lost
	 * the line would remove the file moments after it was attached: the files are read, never changed. Its times are instants or
	 * in a zone, never floating (`EventDateTime` needs one or the other).
	 */
	override get capabilities() {
		return super.capabilities.with({ entries: { attach: false, floating: false } })
	}

	@converter(withheld<GoogleCalendarCredentials>('refreshToken')) override credentials!: GoogleCalendarCredentials

	constructor(init?: Partial<GoogleCalendar>) {
		super()
		this.credentials = { username: '', refreshToken: '' }
		Object.assign(this, init)
	}

	override toString() {
		return `Google Calendar integration for "${this.credentials.username}"`
	}

	override merge(_incoming: CalDAV) { }

	override get syncInterval() { return 60_000 }

	/** Its endpoint is fixed, and discovery finds the account. */
	override get calendarsAddress() { return undefined }

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
