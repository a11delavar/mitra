import { converter } from '@a11d/converter'
import { User } from '../identity/User.js'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, manyToOne, unique } from '../../infrastructure/model/orm.js'
import { withheld } from '../../infrastructure/model/withheld.js'
import { type DeviceFacts } from './deviceFacts.js'

type PushKeys = { p256dh: string, auth: string }

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

	/** The device's zone, which floating reminders resolve in. */
	@property({ type: 'string', nullable: true }) timeZone?: string | null

	/** The app's locale on this device (a BCP 47 tag), which its notifications are written and formatted in. */
	@property({ type: 'string', nullable: true }) locale?: string | null

	@property({ type: 'string', nullable: true }) platform?: string | null
	@property({ type: 'string', nullable: true }) browser?: string | null
	@property({ type: 'boolean', nullable: true }) mobile?: boolean | null

	@property({ type: 'Date', nullable: true }) lastSeenAt?: Date | null

	constructor(init?: Partial<NotificationSubscription>) {
		Object.assign(this, init)
	}

	/**
	 * Restamps what the device reports on every registration, leaving the user's `name` alone. A browser signed in to by
	 * another user becomes theirs, as its endpoint is unique, but the name the previous user gave it does not.
	 */
	register(userId: string, registration: DeviceFacts & { keys: PushKeys, timeZone?: string, locale?: string }) {
		if (this.userId && this.userId !== userId) {
			this.name = null
		}
		this.userId = userId
		this.keys = registration.keys
		this.timeZone = registration.timeZone ?? null
		this.locale = NotificationSubscription.localeOf(registration.locale) ?? this.locale ?? null
		this.platform = registration.platform ?? null
		this.browser = registration.browser ?? null
		this.mobile = registration.mobile ?? null
		this.lastSeenAt = new Date()
	}

	/** A tag every Intl formatter takes: one they refuse would throw at each of the device's reminders. */
	private static localeOf(tag: unknown) {
		try {
			return typeof tag === 'string' ? Intl.getCanonicalLocales(tag)[0] : undefined
		} catch {
			return undefined
		}
	}

	/**
	 * Takes over from the subscription the browser rotated away from. The service worker that re-subscribes
	 * cannot read the app's locale, and the user's name belongs to the device, not the endpoint.
	 */
	succeed(previous: NotificationSubscription) {
		this.name ??= previous.name
		this.locale ??= previous.locale
	}

	/** An empty name falls back to what the browser reports. */
	rename(name: string | undefined) {
		this.name = name || null
	}
}
