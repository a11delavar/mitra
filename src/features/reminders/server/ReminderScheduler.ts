import { type EntityManager, type MikroORM } from '@mikro-orm/sqlite'
import { DateTimeRange } from '@3mo/date-time'
import { Source } from '#features/sources'
import { Entry } from '#features/entries'
import { withOverrides } from '#features/entries/server/entryWindow.js'
import { EntryOccurrences, type EntryOccurrence } from '#features/recurrence'
import '#features/time/TimeSpan.time.js'
import { Integration } from '#integrations'
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

/** Maximum UTC offset slack for filtering stored floating entry wall-clock times. */
const ZONE_SLACK = 14 * 60 * MINUTE

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
			const sources = await em.find(Source, {})
			const enabledSourceIds = sources.filter(source => source.enabled).map(source => source.id)

			const rows = await em.find(Entry, {
				sourceId: { $in: enabledSourceIds },
				reminders: { $ne: null },
				recurrence: null,
				// Bounds query to entries whose anchor falls inside/after the watermark window.
				$or: [
					{ start: { $gt: new Date(watermark.getTime() - ZONE_SLACK) } },
					{ start: null, due: { $gt: new Date(watermark.getTime() - ZONE_SLACK) } },
				],
			})
			const masters = await em.find(Entry, { sourceId: { $in: enabledSourceIds }, reminders: { $ne: null }, recurrence: { $ne: null } })
			const horizon = Math.max(0, ...masters.map(master => master.reminders?.earliest ?? 0)) * MINUTE
			await withOverrides(em, masters)
			const occurrences = [
				...rows.map(row => row.occurrences.single),
				...EntryOccurrences.inWindow(masters, new DateTimeRange(watermark, new Date(until.getTime() + horizon))),
			]

			const integrations = await em.find(Integration, {})
			const userByIntegration = new Map(integrations.map(integration => [integration.id, integration.userId]))
			const userBySource = new Map(sources.map(source => [source.id, userByIntegration.get(source.integrationId)]))
			const zoneByUser = await this.observerZones(em)
			const userOf = (occurrence: EntryOccurrence) => userBySource.get(occurrence.entry.sourceId)

			const zoneOf = (occurrence: EntryOccurrence) => {
				const userId = userOf(occurrence)
				return userId ? zoneByUser.get(userId) : undefined
			}
			const due = DueReminder.within(occurrences, watermark, until, zoneOf)
			this.logger.debug(`Tick: window (${watermark.toISOString()}, ${until.toISOString()}]: scanned ${occurrences.length} occurrence(s), ${due.length} due`)

			for (const reminder of due) {
				const userId = userOf(reminder.occurrence)
				const key = `${reminder.occurrence.key}|${reminder.minutes}|${reminder.fireAt}`
				if (!userId || this.dispatched.has(key)) {
					continue
				}
				this.dispatched.set(key, reminder.fireAt)
				this.schedule(userId, reminder, now.getTime())
			}

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

	/** Resolve each user's latest observed device time zone. */
	private async observerZones(em: EntityManager): Promise<Map<string, string>> {
		const subscriptions = await em.find(NotificationSubscription, {}, { orderBy: { lastSeenAt: 'asc' } })
		return new Map(subscriptions.filter(subscription => subscription.timeZone).map(subscription => [subscription.userId, subscription.timeZone!]))
	}
}
