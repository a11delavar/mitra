import { converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { Integration, integration, withheld } from '../Integration.js'

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
	static readonly logo: string = 'ics'
	static readonly description: string = 'Any calendar link — webcal:// or .ics'

	override get capabilities() {
		return {
			...Integration.fullCapabilities,
			relations: false,
			createEntries: false, editEntries: false, deleteEntries: false, renameEntries: false,
		}
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
