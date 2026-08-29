import { Router } from 'express'
import webpush from 'web-push'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { orm } from '../../../infrastructure/database/orm.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { State } from '../../../infrastructure/database/State.js'
import { ReminderNotification, type PushPayload } from '../ReminderNotification.js'

export { type PushPayload }

const logger = createLogger('Push')

/**
 * Web Push (RFC 8030/8291/8292) delivery using auto-generated VAPID keypair.
 * Delivers encrypted notification payloads to all active subscriptions per user.
 */

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
webpush.setVapidDetails(process.env.MITRA_VAPID_SUBJECT || 'mailto:mitra@localhost', vapid.publicKey, vapid.privateKey)

/** Send a notification to every browser the user registered, pruning subscriptions the push service reports gone. */
export async function sendTo(userId: string, payload: PushPayload): Promise<void> {
	const em = orm.em.fork()
	const subscriptions = await em.find(NotificationSubscription, { userId })
	if (subscriptions.length === 0) {
		logger.warn(`"${payload.title}" not delivered: user ${userId} has no push subscriptions on this instance.`)
		return
	}
	const notification = new ReminderNotification(payload)
	const options = { TTL: notification.ttlSeconds(Date.now()), urgency: 'high' } as const
	logger.debug(`Delivering "${payload.title}" to ${subscriptions.length} subscription(s) for user ${userId} (TTL ${options.TTL}s)`)
	await Promise.all(subscriptions.map(async subscription => {
		try {
			await webpush.sendNotification(
				{ endpoint: subscription.endpoint, keys: subscription.keys },
				JSON.stringify(payload),
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

export const pushRouter = Router()

pushRouter.get('/key', (_req, res) => res.json({ key: vapid.publicKey }))

pushRouter.post('/subscription', async (req, res) => {
	const body = req.body as { endpoint?: string, keys?: { p256dh?: string, auth?: string }, timeZone?: string }
	if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
		return res.status(400).json({ error: 'Missing subscription endpoint or keys' })
	}
	const em = orm.em.fork()
	const existing = await em.findOne(NotificationSubscription, { endpoint: body.endpoint })
	const subscription = existing ?? new NotificationSubscription({ id: crypto.randomUUID(), endpoint: body.endpoint })
	subscription.userId = req.user.id
	subscription.keys = { p256dh: body.keys.p256dh, auth: body.keys.auth }
	subscription.timeZone = body.timeZone || null
	subscription.lastSeenAt = new Date()
	em.persist(subscription)
	await em.flush()
	return res.status(existing ? 200 : 201).json(subscription)
})

pushRouter.get('/subscriptions', async (req, res) => {
	const em = orm.em.fork()
	const subscriptions = await em.find(NotificationSubscription, { userId: req.user.id }, { orderBy: { lastSeenAt: 'desc' } })
	return res.json(subscriptions)
})

pushRouter.post('/test', async (req, res) => {
	await sendTo(req.user.id, {
		title: 'Mitra',
		body: '🔔 Notifications are working on this device.',
		tag: 'mitra-test',
		url: '/',
	})
	return res.status(202).end()
})

/** How long a snoozed reminder sleeps before re-notifying (10 min). */
const SNOOZE_MINUTES = 10

pushRouter.post('/snooze', (req, res) => {
	const payload = req.body as Partial<PushPayload>
	if (!payload.title || !payload.tag) {
		return res.status(400).json({ error: 'Missing notification payload' })
	}
	logger.info(`Snoozing "${payload.title}" for ${SNOOZE_MINUTES} minutes`)
	const userId = req.user.id
	setTimeout(() => sendTo(userId, {
		title: payload.title!,
		body: payload.body ?? '',
		tag: payload.tag!,
		timestamp: payload.timestamp,
		url: payload.url,
	}).catch(error => logger.warn('Snoozed re-send failed:', error instanceof Error ? error.message : error)), SNOOZE_MINUTES * 60_000)
	return res.status(202).end()
})

pushRouter.delete('/subscription', async (req, res) => {
	const { endpoint } = req.query as { endpoint?: string }
	if (!endpoint) {
		return res.status(400).json({ error: 'Missing endpoint' })
	}
	const em = orm.em.fork()
	const subscription = await em.findOne(NotificationSubscription, { endpoint })
	if (subscription) {
		em.remove(subscription)
		await em.flush()
	}
	return res.status(204).end()
})

