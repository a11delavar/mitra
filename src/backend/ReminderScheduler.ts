import { type MikroORM } from '@mikro-orm/sqlite'
import fs from 'fs'
import { Entry, Integration, Source, createLogger } from '../shared/index.js'
import { expandedOccurrences } from './occurrences.js'
import { dueReminders, reminderSpan } from './reminderDomain.js'
import { sendTo } from './push.js'

/**
 * The reminder clock: something has to compute "it is now 30 minutes before that event" while every
 * client sleeps — that is inherently the server's job (the whole point of push is that no tab is open).
 *
 * Each tick fires every reminder whose fire time falls inside `(watermark, now]` (see reminderDomain.ts),
 * then advances the persisted watermark. The watermark is what makes delivery exactly-once across
 * restarts: nothing before it re-fires, nothing between ticks is skipped. After a long downtime it is
 * clamped forward — a reminder for a meeting that started hours ago is noise, not a notification.
 *
 * Recurring series fire per occurrence: masters are expanded through the same {@link expandedOccurrences}
 * the calendar renders, so EXDATEs, overrides, and truncations all behave identically to what's on screen.
 */

const MINUTE = 60_000

/** Missed-while-down grace: reminders older than this on boot are dropped, not replayed. */
const CLAMP = 15 * MINUTE

export class ReminderScheduler {
	private readonly logger = createLogger('Reminders')

	private static readonly interval = 60_000
	private readonly watermarkPath = `${import.meta.dirname}/../../data/reminders.json`

	private ticking = false

	constructor(private readonly orm: MikroORM) { }

	start() {
		this.logger.info(`Started reminder scheduler. Will check every ${ReminderScheduler.interval / 1000}s.`)
		this.tick()
		setInterval(() => this.tick(), ReminderScheduler.interval)
	}

	private get watermark(): Date | undefined {
		try {
			return new Date(JSON.parse(fs.readFileSync(this.watermarkPath, 'utf8')).watermark as string)
		} catch {
			return undefined
		}
	}

	private set watermark(value: Date) {
		fs.writeFileSync(this.watermarkPath, JSON.stringify({ watermark: value.toISOString() }, undefined, '\t'))
	}

	private async tick() {
		if (this.ticking) {
			return
		}
		this.ticking = true
		try {
			const now = new Date()
			const persisted = this.watermark?.getTime() ?? now.getTime()
			const watermark = new Date(Math.max(persisted, now.getTime() - CLAMP))

			const em = this.orm.em.fork()

			// Plain rows and synced overrides carry their own reminders; recurring masters fire per
			// occurrence, expanded far enough ahead that a long offset ("1 week before") is already in
			// range. Hidden sources still fire — hiding is a view preference, not a mute.
			const rows = await em.find(Entry, { reminders: { $ne: null }, recurrence: { freq: null } })
			const masters = await em.find(Entry, { reminders: { $ne: null }, recurrence: { freq: { $ne: null } } })
			const horizon = Math.max(0, ...masters.flatMap(master => master.reminders ?? [])) * MINUTE
			const sources = await em.find(Source, {})
			const enabledSourceIds = sources.filter(source => source.enabled).map(source => source.id)
			const occurrences = masters.length
				? (await expandedOccurrences(em, enabledSourceIds, watermark, new Date(now.getTime() + horizon)))
					.filter(occurrence => occurrence.reminders?.length)
				: []

			// The scheduler ticks for EVERY user; each reminder routes to its entry's owner
			// (entry → source → integration → user).
			const integrations = await em.find(Integration, {})
			const userByIntegration = new Map(integrations.map(integration => [integration.id, integration.userId]))
			const userBySource = new Map(sources.map(source => [source.id, userByIntegration.get(source.integrationId)]))

			for (const { entry, minutes } of dueReminders([...rows, ...occurrences], watermark, now)) {
				const userId = userBySource.get(entry.sourceId)
				if (!userId) {
					continue
				}
				this.logger.info(`Reminder: "${entry.heading}" starts ${minutes ? `in ${reminderSpan(minutes)}` : 'now'}`)
				await sendTo(userId, {
					title: entry.heading || 'Untitled',
					// Relative wording on purpose: the server may run in another timezone than the reader.
					// Emoji as separators — a notification body has no other typography to structure it with.
					body: [
						`⏰ ${minutes === 0 ? 'Starts now' : `Starts in ${reminderSpan(minutes)}`}`,
						!entry.location ? undefined : `📍 ${entry.location}`,
					].filter(Boolean).join(' '),
					tag: `${entry.id}|${minutes}`,
					timestamp: (entry.start as unknown as Date).getTime(),
					url: '/',
				})
			}

			this.watermark = now
		} catch (error) {
			this.logger.error('Reminder tick failed:', error)
		} finally {
			this.ticking = false
		}
	}
}
