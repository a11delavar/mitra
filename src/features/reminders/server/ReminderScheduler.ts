import { type MikroORM } from '@mikro-orm/sqlite'
import { User } from '#features/identity'
import '#features/time/TimeSpan.time.js'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { localizeIn } from '#infrastructure/i18n/dictionaries.js'
import { State } from '#infrastructure/database/State.js'
import { DueReminder } from '../Reminders.js'
import { NotificationSubscription } from '../NotificationSubscription.js'
import { sendTo } from './push.js'

/**
 * Periodic reminder tick scheduler. Scans upcoming reminders in `(watermark, now + interval]` window,
 * exact-schedules timers, and manages persistent watermark for crash-resilient exactly-once delivery.
 */

const MINUTE = 60_000

/** Missed-while-down grace: reminders older than this on boot are dropped, not replayed. */
const CLAMP = 15 * MINUTE

export class ReminderScheduler {
	private readonly logger = createLogger('Reminders')

	private static readonly interval = 60_000
	private static readonly watermarkStateKey = 'reminder.watermark'

	private ticking = false

	/** In-flight timers keyed by `entryId|minutes|fireAt`. */
	private readonly dispatched = new Map<string, number>()

	constructor(private readonly orm: MikroORM) { }

	start() {
		this.logger.info(`Started reminder scheduler. Will check every ${ReminderScheduler.interval / 1000}s.`)
		this.tick()
		setInterval(() => this.tick(), ReminderScheduler.interval)
	}

	private async readWatermark(): Promise<Date | undefined> {
		const iso = await State.read<string>(this.orm.em.fork(), ReminderScheduler.watermarkStateKey)
		return iso ? new Date(iso) : undefined
	}

	private writeWatermark(value: Date) {
		return State.write(this.orm.em.fork(), ReminderScheduler.watermarkStateKey, value.toISOString())
	}

	private async tick() {
		if (this.ticking) {
			return
		}
		this.ticking = true
		try {
			const now = new Date()
			const persisted = (await this.readWatermark())?.getTime() ?? now.getTime()
			const watermark = new Date(Math.max(persisted, now.getTime() - CLAMP))
			if (persisted < watermark.getTime()) {
				this.logger.warn(`Skipped reminders due between ${new Date(persisted).toISOString()} and ${watermark.toISOString()}: too far behind to still be useful.`)
			}
			const until = new Date(now.getTime() + ReminderScheduler.interval)

			const em = this.orm.em.fork()
			// Only those with a device are reminded, each where their device was seen last.
			const devices = Map.groupBy(await em.find(NotificationSubscription, {}, { orderBy: { lastSeenAt: 'desc' } }), device => device.userId)
			let scheduled = 0
			for (const user of await em.find(User, { id: { $in: [...devices.keys()] } })) {
				const zone = devices.get(user.id)!.find(device => device.timeZone)?.timeZone
				for (const reminder of await DueReminder.of(em, user, watermark, until, zone)) {
					const key = `${reminder.occurrence.key}|${reminder.minutes}|${reminder.fireAt}`
					if (this.dispatched.has(key)) {
						continue
					}
					this.dispatched.set(key, reminder.fireAt)
					this.schedule(user.id, reminder, now.getTime())
					scheduled++
				}
			}
			this.logger.debug(`Tick: window (${watermark.toISOString()}, ${until.toISOString()}]: ${scheduled} reminder(s) scheduled`)

			// Advance watermark only to `now` so unexecuted timers in `(now, until]` remain recoverable on crash.
			await this.writeWatermark(now)
			for (const [key, fireAt] of this.dispatched) {
				if (fireAt <= now.getTime()) {
					this.dispatched.delete(key)
				}
			}
		} catch (error) {
			this.logger.error('Reminder tick failed:', error)
		} finally {
			this.ticking = false
		}
	}

	/** Schedule exact timer for reminder delivery. */
	private schedule(userId: string, reminder: DueReminder, now: number) {
		const { occurrence: { entry }, minutes, fireAt } = reminder
		const notification = reminder.notification()
		const send = () => {
			this.logger.info(`Reminder: "${entry.heading}" ${minutes ? `in ${TimeSpan.fromMinutes(minutes).formatAsWholeUnit(localizeIn('en'))}` : 'now'}`)
			sendTo(userId, notification).catch(error => this.logger.warn('Reminder delivery failed:', error instanceof Error ? error.message : error))
		}
		const delay = fireAt - now
		if (delay <= 0) {
			send()
		} else {
			setTimeout(send, delay)
		}
	}
}
