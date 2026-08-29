import { User } from '../identity/User.js'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, manyToOne, unique } from '../../infrastructure/model/orm.js'

/** Web Push registration storing endpoint URL, keys, observer timeZone, and lastSeenAt timestamp. */
@model('NotificationSubscription')
@entity()
@unique({ properties: ['endpoint'] })
export class NotificationSubscription {
	@primaryKey({ type: 'string' }) id!: string
	@manyToOne(() => User, { mapToPk: true, deleteRule: 'cascade' }) userId!: string
	@property({ type: 'string' }) endpoint!: string
	@property({ type: 'json' }) keys!: { p256dh: string, auth: string }

	/** Browser IANA time zone used to resolve floating entry reminders. */
	@property({ type: 'string', nullable: true }) timeZone?: string | null

	/** Timestamp when this device last re-registered. */
	@property({ type: 'datetime', nullable: true }) lastSeenAt?: Date | null

	constructor(init?: Partial<NotificationSubscription>) {
		Object.assign(this, init)
	}
}
