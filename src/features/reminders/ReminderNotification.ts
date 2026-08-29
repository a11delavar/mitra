/**
 * Wire payload and delivery timing heuristics for Web Push reminders (RFC 8030 TTL and dynamic body formatting).
 * Bundled dependency-free into the service worker.
 */

const MINUTE = 60_000

/** Wire push notification payload. */
export interface PushPayload {
	title: string
	/** Pre-rendered fallback body text. */
	body: string
	/** Browser notification replacement tag. */
	tag: string
	/** Anchor event timestamp in epoch ms. */
	timestamp?: number
	/** Target URL on notification click. */
	url?: string
	reminder?: {
		/** Authored offset in minutes before anchor. */
		minutes: number
		location?: string
	}
}

/** Format exact reminder offset unit. */
export function reminderSpan(minutes: number): string {
	const units = [
		{ label: 'week', minutes: 7 * 24 * 60 },
		{ label: 'day', minutes: 24 * 60 },
		{ label: 'hour', minutes: 60 },
	]
	const unit = units.find(unit => minutes >= unit.minutes && minutes % unit.minutes === 0)
	if (!unit) {
		return `${minutes} min`
	}
	const count = minutes / unit.minutes
	return `${count} ${unit.label}${count === 1 ? '' : 's'}`
}

export class ReminderNotification {
	/** Post-start delivery grace window (5 min). */
	private static readonly grace = 5 * MINUTE

	/** Tolerance threshold for authored reminder wording (90s). */
	private static readonly tolerance = 90_000

	constructor(readonly payload: PushPayload) { }

	/** Compose reminder payload pre-rendered for instant `at`. */
	static compose(init: Omit<PushPayload, 'body'>, at: number): PushPayload {
		const notification = new ReminderNotification({ ...init, body: '' })
		return { ...notification.payload, body: notification.bodyAt(at) }
	}

	/** Calculate RFC 8030 push message TTL in seconds. */
	ttlSeconds(now: number): number {
		const start = this.payload.timestamp ?? now
		return Math.ceil((Math.max(0, start - now) + ReminderNotification.grace) / 1000)
	}

	/** Format body text at delivery time. */
	bodyAt(now: number): string {
		const timing = this.timingAt(now)
		if (timing === undefined) {
			return this.payload.body
		}
		const location = this.payload.reminder?.location
		return [timing, !location ? undefined : `📍 ${location}`].filter(Boolean).join(' ')
	}

	private timingAt(now: number): string | undefined {
		const start = this.payload.timestamp
		const minutes = this.payload.reminder?.minutes
		if (start === undefined || minutes === undefined) {
			return undefined
		}
		if (Math.abs(now - (start - minutes * MINUTE)) <= ReminderNotification.tolerance) {
			return `⏰ ${minutes === 0 ? 'Starts now' : `Starts in ${reminderSpan(minutes)}`}`
		}
		const remaining = start - now
		if (Math.abs(remaining) < MINUTE) {
			return '⏰ Starts now'
		}
		return remaining > 0
			? `⏰ Starts in ${ReminderNotification.approximateSpan(remaining)}`
			: `⏰ Started ${ReminderNotification.approximateSpan(-remaining)} ago`
	}

	/** Format measured elapsed duration in coarse units. */
	private static approximateSpan(milliseconds: number): string {
		const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`
		const minutes = Math.round(milliseconds / MINUTE)
		if (minutes < 60) {
			return `${minutes} min`
		}
		const hours = Math.round(minutes / 60)
		return hours < 24 ? plural(hours, 'hour') : plural(Math.round(hours / 24), 'day')
	}
}

