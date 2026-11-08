import webpush from 'web-push'
import type { User } from '#features/identity'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { orm } from '#infrastructure/database/orm.js'
import { State } from '#infrastructure/database/State.js'
import { environment, type Environment } from '#infrastructure/server/Environment.js'
import type { ReminderNotification } from '../ReminderNotification.js'

const logger = createLogger('Push')

interface VapidKeys {
	readonly publicKey: string
	readonly privateKey: string
}

/** Delivers notifications to a user's devices through Web Push, signed with the instance's own keys, made once and kept. */
export class Push {
	private keys?: Promise<VapidKeys>

	constructor(private readonly environment: Environment) { }

	/** The instance's keys, read or made on first use rather than as the server loads. */
	private vapid() {
		return this.keys ??= (async () => {
			const stored = await State.read<VapidKeys>(orm.em.fork(), 'vapid')
			if (stored) {
				return stored
			}
			const made = webpush.generateVAPIDKeys()
			await State.write(orm.em.fork(), 'vapid', made)
			logger.info('Generated a new VAPID keypair for push notifications')
			return made
		})()
	}

	/** The key a browser subscribes with. */
	async publicKey() {
		return (await this.vapid()).publicKey
	}

	/** Renders the notification for each device the user registered, in that device's locale and zone; a device gone for good is let go. */
	async send(user: User, notification: ReminderNotification) {
		const em = orm.em.fork()
		const devices = await user.getDevices(em)
		const heading = notification.facts.heading
		if (!devices.length) {
			logger.warn(`"${heading}" not delivered: user ${user.id} has no push subscriptions on this instance.`)
			return
		}
		const { publicKey, privateKey } = await this.vapid()
		const now = Date.now()
		const options = { TTL: notification.ttlSeconds(now), urgency: 'high', vapidDetails: { subject: this.environment.vapidSubject, publicKey, privateKey } } as const
		logger.debug(`Delivering "${heading}" to ${devices.length} subscription(s) for user ${user.id} (TTL ${options.TTL}s)`)
		await Promise.all(devices.map(async device => {
			try {
				await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify(notification.for(device, now)), options)
			} catch (error) {
				const status = (error as { statusCode?: number }).statusCode
				if (status === 404 || status === 410) {
					em.remove(device)
					logger.info(`Pruned a gone push subscription for user ${user.id} (${device.endpoint.slice(0, 48)}…).`)
				} else {
					logger.warn(`Push to ${device.endpoint.slice(0, 48)}… failed:`, error instanceof Error ? error.message : error)
				}
			}
		}))
		await em.flush()
	}
}

export const push = new Push(environment)
