import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { trimmed } from './push.js'

class Registration {
	@validation(z.string().min(1, 'Missing subscription endpoint or keys'))
	@description('The push subscription\'s endpoint.')
	readonly endpoint!: string

	@validation(z.string().nullish())
	@description('The endpoint this subscription replaces, whose name it takes over.')
	readonly previousEndpoint?: string

	@validation(z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }, 'Missing subscription endpoint or keys'))
	@description('The subscription\'s keys.')
	readonly keys!: { readonly p256dh: string, readonly auth: string }

	@validation(z.string().nullish())
	@description('The zone the device runs in, which its reminders are worded in.')
	readonly timeZone?: string

	@validation(z.string().nullish())
	@description('The locale its reminders are worded in.')
	readonly locale?: string

	@validation(z.string().nullish())
	@description('What a page loaded before locales sends until it reloads.')
	readonly language?: string

	@validation(z.string().nullish())
	@description('The device\'s platform, which names it.')
	readonly platform?: string

	@validation(z.string().nullish())
	@description('The browser, which names the device.')
	readonly browser?: string

	@validation(z.boolean().nullish())
	@description('Whether the browser reports a mobile device.')
	readonly mobile?: boolean
}

@operation(Registration)
@label('Register a device')
@description('Registers a browser\'s push subscription for reminders, with the locale and zone they are worded in; a rotated subscription takes over its predecessor\'s name.')
@http({ method: 'POST', path: '/push/subscription' })
export class RegisterDevice extends Operation<Registration, NotificationSubscription> {
	async run({ em, user }: OperationContext) {
		const { endpoint, previousEndpoint, keys, timeZone, locale, language, platform, browser, mobile } = this.parameters
		const existing = await em.findOne(NotificationSubscription, { endpoint })
		const subscription = existing ?? new NotificationSubscription({ id: crypto.randomUUID(), endpoint })
		subscription.register(user.id, {
			keys: { p256dh: keys.p256dh, auth: keys.auth },
			timeZone: trimmed(timeZone, 64),
			locale: locale ?? language ?? undefined,
			platform: trimmed(platform, 64),
			browser: trimmed(browser, 64),
			mobile: mobile ?? undefined,
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
