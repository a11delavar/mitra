import { converter } from '@a11d/converter'
import { User } from '../identity/User.js'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, manyToOne, unique } from '../../infrastructure/model/orm.js'
import { withheld } from '../../infrastructure/model/withheld.js'
import { type DeviceFacts } from './deviceFacts.js'

type PushKeys = { p256dh: string, auth: string }

/** Web Push registration storing endpoint URL, keys, and what the device reports about itself. */
@model('NotificationSubscription')
@entity()
@unique({ properties: ['endpoint'] })
export class NotificationSubscription {
	@primaryKey({ type: 'string' }) id!: string
	@manyToOne(() => User, { mapToPk: true, deleteRule: 'cascade' }) userId!: string
	@property({ type: 'string' }) endpoint!: string

	/** The delivery secret, never sent to a client. */
	@property({ type: 'json' })
	@converter(withheld<PushKeys>('p256dh', 'auth')) keys!: PushKeys

	@property({ type: 'string', nullable: true }) name?: string | null

	/** Browser IANA time zone used to resolve floating entry reminders. */
	@property({ type: 'string', nullable: true }) timeZone?: string | null

	/** The app's language on this device, which its notifications are written in. */
	@property({ type: 'string', nullable: true }) language?: string | null

	@property({ type: 'string', nullable: true }) platform?: string | null
	@property({ type: 'string', nullable: true }) browser?: string | null
	@property({ type: 'boolean', nullable: true }) mobile?: boolean | null

	/** Timestamp when this device last re-registered. */
	@property({ type: 'datetime', nullable: true }) lastSeenAt?: Date | null

	constructor(init?: Partial<NotificationSubscription>) {
		Object.assign(this, init)
	}

	/** Restamps what the device reports on every registration, leaving the user's `name` alone. */
	register(userId: string, registration: DeviceFacts & { keys: PushKeys, timeZone?: string, language?: string }) {
		this.userId = userId
		this.keys = registration.keys
		this.timeZone = registration.timeZone ?? null
		this.language = registration.language ?? this.language ?? null
		this.platform = registration.platform ?? null
		this.browser = registration.browser ?? null
		this.mobile = registration.mobile ?? null
		this.lastSeenAt = new Date()
	}

	/**
	 * Takes over from the subscription the browser rotated away from. The service worker that re-subscribes
	 * cannot read the app's language, and the user's name belongs to the device, not the endpoint.
	 */
	succeed(previous: NotificationSubscription) {
		this.name ??= previous.name
		this.language ??= previous.language
	}

	/** An empty name falls back to what the browser reports. */
	rename(name: string | undefined) {
		this.name = name || null
	}
}
