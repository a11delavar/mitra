import { converter } from '@a11d/converter'
import { Integration, integration, IntegrationCapabilities, IntegrationOwnership } from '#integrations'
import { model, withheld } from '#infrastructure/model'

export interface IcsFeed {
	text: string
	etag?: string
	lastModified?: string
	notModified?: boolean
}

export interface IcsSubscriptionCredentials {
	/** Calendar name derived from feed (X-WR-CALNAME or file name). */
	username: string
	/** Optional HTTP Basic auth username. */
	authUsername?: string
	password?: string
}

/** Published iCalendar (.ics / webcal) feed subscription integration. */
@model('IcsSubscription')
@integration('ics')
export class IcsSubscription extends Integration<IcsSubscriptionCredentials> {
	static readonly label: string = 'Calendar Subscription'
	static override readonly docs: string | undefined = 'integrations/subscriptions'
	static readonly logo: string = 'ics'
	static readonly description: string = 'Any calendar link (webcal:// or .ics)'

	override get capabilities() {
		return new IntegrationCapabilities({ entries: { create: false, edit: false, delete: false, rename: false, cancel: false, attach: false } })
	}

	/** What a feed's iCalendar carries, but links: a feed's relations point at entries it may not hold. */
	override get ownership() {
		return new IntegrationOwnership({
			recurrence: 'upstream', reminders: 'upstream', location: 'upstream', description: 'upstream', percentComplete: 'upstream',
			due: 'upstream', estimate: 'upstream', timeZone: 'upstream', participants: 'upstream', attachments: 'upstream',
			transparency: 'upstream', visibility: 'upstream', allDay: 'upstream', rank: 'mitra',
		})
	}

	override get sourceIcon() { return 'rss' }

	override get canConnect() {
		return !!this.uri
	}

	override get syncInterval() { return 15 * 60_000 }

	@converter({ out: {} }) feed?: Promise<IcsFeed>

	@converter(withheld<IcsSubscriptionCredentials>('password')) override credentials!: IcsSubscriptionCredentials

	constructor(init?: Partial<IcsSubscription>) {
		super()
		this.uri = ''
		this.credentials = { username: '', authUsername: '', password: '' }
		Object.assign(this, init)
	}

	override toString() {
		return `Calendar subscription "${this.credentials.username || this.uri}"`
	}

	static normalizeUrl(raw: string | undefined): string | undefined {
		const trimmed = raw?.trim()
		if (!trimmed) {
			return undefined
		}
		const upgraded = trimmed.replace(/^webcals?:\/\//i, 'https://')
		try {
			const url = new URL(upgraded)
			return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
		} catch {
			return undefined
		}
	}

	override merge(incoming: this) {
		this.uri = this.uri || IcsSubscription.normalizeUrl(incoming.uri)
		this.credentials = {
			username: this.credentials.username ?? '',
			authUsername: incoming.credentials?.authUsername ?? this.credentials.authUsername,
			password: incoming.credentials?.password || this.credentials.password,
		}
	}
}
