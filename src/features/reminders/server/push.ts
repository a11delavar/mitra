import { Router } from 'express'
import webpush from 'web-push'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { orm } from '../../../infrastructure/database/orm.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { State } from '../../../infrastructure/database/State.js'
import { ReminderNotification } from '../ReminderNotification.js'

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

/**
 * Send a notification to every browser the user registered, each rendered in that device's language and zone,
 * pruning subscriptions the push service reports gone.
 */
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

export const pushRouter = Router()

pushRouter.get('/key', (_req, res) => res.json({ key: vapid.publicKey }))

const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined

pushRouter.post('/subscription', async (req, res) => {
	const body = req.body as { endpoint?: string, previousEndpoint?: string, keys?: { p256dh?: string, auth?: string }, timeZone?: string, language?: string, platform?: string, browser?: string, mobile?: boolean }
	if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
		return res.status(400).json({ error: 'Missing subscription endpoint or keys' })
	}
	const em = orm.em.fork()
	const existing = await em.findOne(NotificationSubscription, { endpoint: body.endpoint })
	const subscription = existing ?? new NotificationSubscription({ id: crypto.randomUUID(), endpoint: body.endpoint })
	subscription.register(req.user.id, {
		keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
		timeZone: text(body.timeZone, 64),
		language: text(body.language, 16),
		platform: text(body.platform, 64),
		browser: text(body.browser, 64),
		mobile: typeof body.mobile === 'boolean' ? body.mobile : undefined,
	})
	const previous = body.previousEndpoint && body.previousEndpoint !== body.endpoint
		? await em.findOne(NotificationSubscription, { endpoint: body.previousEndpoint, userId: req.user.id })
		: null
	if (previous) {
		subscription.succeed(previous)
		em.remove(previous)
	}
	em.persist(subscription)
	await em.flush()
	return res.status(existing ? 200 : 201).json(subscription)
})

pushRouter.get('/subscriptions', async (req, res) => {
	const em = orm.em.fork()
	const subscriptions = await em.find(NotificationSubscription, { userId: req.user.id }, { orderBy: { lastSeenAt: 'desc' } })
	return res.json(subscriptions)
})

pushRouter.put('/subscriptions/:id/name', async (req, res) => {
	const em = orm.em.fork()
	const subscription = await em.findOne(NotificationSubscription, { id: req.params.id, userId: req.user.id })
	if (!subscription) {
		return res.status(404).json({ error: 'No such device' })
	}
	subscription.rename(text((req.body as { name?: unknown }).name, 60))
	await em.flush()
	return res.json(subscription)
})

pushRouter.delete('/subscriptions/:id', async (req, res) => {
	const em = orm.em.fork()
	const subscription = await em.findOne(NotificationSubscription, { id: req.params.id, userId: req.user.id })
	if (subscription) {
		em.remove(subscription)
		await em.flush()
	}
	return res.status(204).end()
})

pushRouter.post('/test', async (req, res) => {
	const { kind } = req.body as { kind?: unknown }
	await sendTo(req.user.id, ReminderNotification.rehearsal(kind === 'task' ? 'task' : 'event', Date.now()))
	return res.status(202).end()
})

pushRouter.post('/snooze', (req, res) => {
	const notification = ReminderNotification.parse(req.body)
	if (!notification) {
		return res.status(400).json({ error: 'Missing notification facts' })
	}
	logger.info(`Snoozing "${notification.facts.heading}" for ${ReminderNotification.snoozeMinutes} minutes`)
	const userId = req.user.id
	setTimeout(
		() => sendTo(userId, notification).catch(error => logger.warn('Snoozed re-send failed:', error instanceof Error ? error.message : error)),
		ReminderNotification.snoozeMinutes * 60_000,
	)
	return res.status(202).end()
})

/** For the service worker cleaning up after a rotated subscription. */
pushRouter.delete('/subscription', async (req, res) => {
	const { endpoint } = req.query as { endpoint?: string }
	if (!endpoint) {
		return res.status(400).json({ error: 'Missing endpoint' })
	}
	const em = orm.em.fork()
	const subscription = await em.findOne(NotificationSubscription, { endpoint, userId: req.user.id })
	if (subscription) {
		em.remove(subscription)
		await em.flush()
	}
	return res.status(204).end()
})
