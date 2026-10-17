import { description, label } from '@a11d/metadata'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { trimmed } from './push.js'

interface Registration {
	readonly endpoint?: string
	readonly previousEndpoint?: string
	readonly keys?: { readonly p256dh?: string, readonly auth?: string }
	readonly timeZone?: string
	readonly locale?: string
	/** What a page loaded before locales sends until it reloads. */
	readonly language?: string
	readonly platform?: string
	readonly browser?: string
	readonly mobile?: boolean
}

@operation()
@label('Register a device')
@description('Registers a browser\'s push subscription for reminders, with the locale and zone they are worded in; a rotated subscription takes over its predecessor\'s name.')
@http({ method: 'POST', path: '/push/subscription' })
export class RegisterDevice extends Operation<Registration, NotificationSubscription> {
	async run({ em, user }: OperationContext): Promise<NotificationSubscription> {
		const { endpoint, previousEndpoint, keys, timeZone, locale, language, platform, browser, mobile } = this.parameters
		if (!endpoint || !keys?.p256dh || !keys.auth) {
			throw new ValidationError('Missing subscription endpoint or keys', ['endpoint', 'keys'])
		}
		const existing = await em.findOne(NotificationSubscription, { endpoint })
		const subscription = existing ?? new NotificationSubscription({ id: crypto.randomUUID(), endpoint })
		subscription.register(user.id, {
			keys: { p256dh: keys.p256dh, auth: keys.auth },
			timeZone: trimmed(timeZone, 64),
			locale: locale ?? language,
			platform: trimmed(platform, 64),
			browser: trimmed(browser, 64),
			mobile: typeof mobile === 'boolean' ? mobile : undefined,
		})
		const previous = previousEndpoint && previousEndpoint !== endpoint
			? await em.findOne(NotificationSubscription, { endpoint: previousEndpoint, userId: user.id })
			: null
		if (previous) {
			subscription.succeed(previous)
			em.remove(previous)
		}
		em.persist(subscription)
		await em.flush()
		return subscription
	}
}
