import { model, entity, primaryKey, property, unique } from '../shared/index.js'

/** One browser's Web Push registration (see push.ts): the endpoint URL its push service minted plus the
 * client encryption keys. The endpoint IS the identity (re-subscribing yields the same one), so it's
 * unique and key rotations upsert in place. Reminders fan out to all rows. */
@model('NotificationSubscription')
@entity()
@unique({ properties: ['endpoint'] })
export class NotificationSubscription {
	@primaryKey({ type: 'string' }) id!: string
	@property({ type: 'string' }) endpoint!: string
	@property({ type: 'json' }) keys!: { p256dh: string, auth: string }

	constructor(init?: Partial<NotificationSubscription>) {
		Object.assign(this, init)
	}
}
