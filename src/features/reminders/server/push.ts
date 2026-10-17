import webpush from 'web-push'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { orm } from '../../../infrastructure/database/orm.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { State } from '../../../infrastructure/database/State.js'
import type { ReminderNotification } from '../ReminderNotification.js'

const logger = createLogger('Push')

interface VapidKeys { publicKey: string, privateKey: string }

async function vapidKeys(): Promise<VapidKeys> {
	const key = 'vapid'
	const existing = await State.read<VapidKeys>(orm.em.fork(), key)
	if (existing) {
		return existing
	}
	const keys = webpush.generateVAPIDKeys()
	await State.write(orm.em.fork(), key, keys)
	logger.info('Generated a new VAPID keypair for push notifications')
	return keys
}

const vapid = await vapidKeys()

export const vapidPublicKey = vapid.publicKey
webpush.setVapidDetails(process.env.MITRA_VAPID_SUBJECT || 'mailto:mitra@localhost', vapid.publicKey, vapid.privateKey)

/** Renders the notification for each device the user registered, in that device's locale and zone. */
export async function sendTo(userId: string, notification: ReminderNotification): Promise<void> {
	const em = orm.em.fork()
	const subscriptions = await em.find(NotificationSubscription, { userId })
	const heading = notification.facts.heading
	if (subscriptions.length === 0) {
		logger.warn(`"${heading}" not delivered: user ${userId} has no push subscriptions on this instance.`)
		return
	}
	const now = Date.now()
	const options = { TTL: notification.ttlSeconds(now), urgency: 'high' } as const
	logger.debug(`Delivering "${heading}" to ${subscriptions.length} subscription(s) for user ${userId} (TTL ${options.TTL}s)`)
	await Promise.all(subscriptions.map(async subscription => {
		try {
			await webpush.sendNotification(
				{ endpoint: subscription.endpoint, keys: subscription.keys },
				JSON.stringify(notification.for(subscription, now)),
				options,
			)
		} catch (error) {
			const status = (error as { statusCode?: number }).statusCode
			if (status === 404 || status === 410) {
				em.remove(subscription)
				logger.info(`Pruned a gone push subscription for user ${userId} (${subscription.endpoint.slice(0, 48)}…).`)
			} else {
				logger.warn(`Push to ${subscription.endpoint.slice(0, 48)}… failed:`, error instanceof Error ? error.message : error)
			}
		}
	}))
	await em.flush()
}

/** A device's text as it may be kept: trimmed, at most `max` characters, none when blank. */
export function trimmed(value: unknown, max: number) {
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined
}
