import { Router } from 'express'
import fs from 'fs'
import webpush from 'web-push'
import { createLogger } from '../shared/index.js'
import { orm } from './orm.js'
import { NotificationSubscription } from './NotificationSubscription.js'

const logger = createLogger('Push')

/**
 * Web Push (RFC 8030/8291/8292) delivery — the self-hosted way to OS-level notifications: the browser's
 * push service (FCM/Mozilla/Apple) wakes mitra's service worker even with no tab open, payloads are
 * end-to-end encrypted so those services can't read them, and authentication is a VAPID keypair mitra
 * generates for itself on first boot — no accounts, no third parties, nothing to configure.
 *
 * Each browser profile that granted notification permission registers one subscription (an endpoint URL
 * plus its encryption keys); reminders fan out to all of them. Dead subscriptions (404/410 — the user
 * revoked permission or the browser expired the endpoint) are pruned on send.
 */

// The keypair lives next to the database: it must survive restarts (subscriptions are bound to the
// public key — rotating it silently invalidates every one of them) and belongs to this deployment.
const vapidPath = `${import.meta.dirname}/../../data/vapid.json`

function vapidKeys(): { publicKey: string, privateKey: string } {
	try {
		return JSON.parse(fs.readFileSync(vapidPath, 'utf8')) as { publicKey: string, privateKey: string }
	} catch {
		const keys = webpush.generateVAPIDKeys()
		fs.writeFileSync(vapidPath, JSON.stringify(keys, undefined, '\t'))
		logger.info('Generated a new VAPID keypair for push notifications')
		return keys
	}
}

const vapid = vapidKeys()
// The subject identifies the sender to push services (their abuse contact); a mailto is customary.
webpush.setVapidDetails(process.env.MITRA_VAPID_SUBJECT || 'mailto:mitra@localhost', vapid.publicKey, vapid.privateKey)

export interface PushPayload {
	title: string
	body: string
	/** Coalesces re-sends of the same logical notification (browser-side replace, not stack). */
	tag: string
	/** The event's start (epoch ms) — shown by the OS instead of the delivery time. */
	timestamp?: number
	/** Where a click takes the user. */
	url?: string
}

/** Send a notification to every browser the user registered, pruning subscriptions the push service reports gone. */
export async function sendTo(userId: string, payload: PushPayload): Promise<void> {
	const em = orm.em.fork()
	const subscriptions = await em.find(NotificationSubscription, { userId })
	if (subscriptions.length === 0) {
		// A reminder (or snooze) fired but this instance has no one to deliver it to — the usual cause of
		// "the log says it fired but I got nothing". Subscriptions are per-instance: the browser must have
		// granted permission and subscribed against THIS deployment's origin, not just some other instance.
		logger.warn(`"${payload.title}" not delivered: user ${userId} has no push subscriptions on this instance.`)
		return
	}
	logger.debug(`Delivering "${payload.title}" to ${subscriptions.length} subscription(s) for user ${userId}`)
	await Promise.all(subscriptions.map(async subscription => {
		try {
			await webpush.sendNotification(
				{ endpoint: subscription.endpoint, keys: subscription.keys },
				JSON.stringify(payload),
			)
		} catch (error) {
			const status = (error as { statusCode?: number }).statusCode
			if (status === 404 || status === 410) {
				em.remove(subscription) // revoked/expired — the push service says this endpoint is gone
				// Log it: a silently vanishing subscription is why a browser can stop getting reminders
				// with no error, so leave a trace of when and why the row went away.
				logger.info(`Pruned a gone push subscription for user ${userId} (${subscription.endpoint.slice(0, 48)}…).`)
			} else {
				logger.warn(`Push to ${subscription.endpoint.slice(0, 48)}… failed:`, error instanceof Error ? error.message : error)
			}
		}
	}))
	await em.flush()
}

export const pushRouter = Router()

// The public key the browser subscribes against (applicationServerKey).
pushRouter.get('/key', (_req, res) => res.json({ key: vapid.publicKey }))

pushRouter.post('/subscription', async (req, res) => {
	const body = req.body as { endpoint?: string, keys?: { p256dh?: string, auth?: string } }
	if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
		return res.status(400).json({ error: 'Missing subscription endpoint or keys' })
	}
	const em = orm.em.fork()
	const existing = await em.findOne(NotificationSubscription, { endpoint: body.endpoint })
	const subscription = existing ?? new NotificationSubscription({ id: crypto.randomUUID(), endpoint: body.endpoint })
	// A browser belongs to whoever is signed in on it: re-registration (which the frontend performs on
	// every boot) reassigns the endpoint, so reminders never chase a previous user of a shared browser.
	subscription.userId = req.user.id
	subscription.keys = { p256dh: body.keys.p256dh, auth: body.keys.auth }
	em.persist(subscription)
	await em.flush()
	return res.status(existing ? 200 : 201).json(subscription)
})

/** How long a snoozed reminder sleeps before re-notifying. */
const SNOOZE_MINUTES = 10

// Snooze: the service worker posts the notification's own payload back; it re-fires after the pause.
// Deliberately in-memory — a pending snooze not surviving a server restart inside its 10-minute window
// is a far smaller sin than a persistence layer for it.
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

// Deliberately keyed by endpoint alone, not by owner: push services mint endpoints per browser
// profile, so knowing one IS possession of that browser — and an unsubscribe must work even after
// another user signed in on it and took the row over.
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
