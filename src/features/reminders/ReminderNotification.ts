/**
 * What a reminder is about, and how its notification reads on one device. Rendered on the server, per device,
 * in that device's language and zone; the service worker only shows the result. The body states the entry's
 * time, never a countdown: a shown notification is never re-rendered, and Android counts down from `timestamp`.
 */

import { localizeIn } from '../../infrastructure/i18n/dictionaries.js'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** When the entry happens, in epoch ms. */
export interface PushWhen {
	start?: number
	end?: number
	/** Instants are UTC-midnight encodings, read back in UTC. */
	allDay?: boolean
	/** Instants encode wall-clock time, read back in UTC. */
	floating?: boolean
	/** A task with no start: the reminder counts back from `end`. */
	due?: boolean
}

export interface PushEntry {
	/** As the calendar renders it: the composite `<master>__<ms>` id for an occurrence. */
	id: string
	master?: string
	recurrenceId?: number
}

/** What a reminder is about; sent along so a device can snooze or complete it. */
export interface ReminderFacts {
	heading: string
	/** Browser notification replacement tag. */
	tag: string
	kind?: 'event' | 'task'
	/** A test notification, headed by its localized name instead of an entry's. */
	rehearsal?: boolean
	/** Anchor event timestamp in epoch ms. */
	timestamp?: number
	when?: PushWhen
	location?: string
	entry?: PushEntry
}

/** Wire push notification payload, rendered for one device and shown as is. */
export interface PushPayload {
	title: string
	body: string
	tag: string
	timestamp?: number
	actions: Array<{ action: 'done' | 'snooze', title: string }>
	/** Target URL on notification click. */
	url: string
	facts: ReminderFacts
}

/** The device a notification is rendered for. */
export interface Reader {
	language?: string | null
	timeZone?: string | null
}

type Localize = ReturnType<typeof localizeIn>

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

/** `YYYY-MM-DD` of an instant in `timeZone`. */
function dayOf(instant: number, timeZone: string | undefined): string {
	const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
		.formatToParts(new Date(instant))
	const part = (type: string) => parts.find(part => part.type === type)?.value ?? ''
	return `${part('year')}-${part('month')}-${part('day')}`
}

export class ReminderNotification {
	/** Post-start delivery grace window (5 min). */
	private static readonly grace = 5 * MINUTE

	static readonly snoozeMinutes = 10

	constructor(readonly facts: ReminderFacts) { }

	/** A real reminder for a made-up entry half an hour out. With no entry behind it, Done only dismisses it. */
	static rehearsal(kind: 'event' | 'task', now: number) {
		const anchor = now + 30 * MINUTE
		return new ReminderNotification({
			heading: '',
			rehearsal: true,
			kind,
			tag: `mitra-test-${kind}`,
			timestamp: anchor,
			when: kind === 'task' ? { end: anchor, due: true } : { start: anchor, end: anchor + 60 * MINUTE },
		})
	}

	/** Facts a device sent back to snooze them, keeping only known fields within bounds. */
	static parse(input: unknown): ReminderNotification | undefined {
		const value = (input ?? {}) as Record<string, unknown>
		const text = (field: unknown, max: number) => typeof field === 'string' && field.trim() ? field.trim().slice(0, max) : undefined
		const number = (field: unknown) => typeof field === 'number' && Number.isFinite(field) ? field : undefined
		const flag = (field: unknown) => field === true || undefined
		const tag = text(value.tag, 120)
		if (!tag) {
			return undefined
		}
		const when = value.when as Record<string, unknown> | undefined
		const entry = value.entry as Record<string, unknown> | undefined
		return new ReminderNotification({
			heading: text(value.heading, 120) ?? '',
			tag,
			kind: value.kind === 'task' || value.kind === 'event' ? value.kind : undefined,
			rehearsal: flag(value.rehearsal),
			timestamp: number(value.timestamp),
			when: !when ? undefined : { start: number(when.start), end: number(when.end), allDay: flag(when.allDay), floating: flag(when.floating), due: flag(when.due) },
			location: text(value.location, 240),
			entry: !text(entry?.id, 200) ? undefined : { id: text(entry!.id, 200)!, master: text(entry!.master, 200), recurrenceId: number(entry!.recurrenceId) },
		})
	}

	/** Calculate RFC 8030 push message TTL in seconds. */
	ttlSeconds(now: number): number {
		const start = this.facts.timestamp ?? now
		return Math.ceil((Math.max(0, start - now) + ReminderNotification.grace) / 1000)
	}

	/** The notification as `reader` shows it. */
	for(reader: Reader, now: number): PushPayload {
		const t = localizeIn(reader.language)
		const { facts } = this
		const title = facts.rehearsal
			? facts.kind === 'task' ? t('Test task') : t('Test event')
			: facts.heading || t('Untitled')
		const snooze = { action: 'snooze' as const, title: t('Snooze ${count} min', { count: ReminderNotification.snoozeMinutes }) }
		// Chrome shows at most two buttons, so there is no "Open": tapping the notification already opens the entry.
		const actions = !facts.kind ? [] : facts.kind === 'task' ? [{ action: 'done' as const, title: t('Done') }, snooze] : [snooze]
		return {
			title,
			body: this.body(reader, now, t),
			tag: facts.tag,
			timestamp: facts.timestamp,
			actions,
			url: this.link(reader.timeZone ?? undefined),
			facts,
		}
	}

	private body(reader: Reader, now: number, t: Localize): string {
		const { when, location } = this.facts
		const at = ReminderNotification.anchorOf(when)
		if (!when || at === undefined) {
			return ''
		}
		const language = reader.language ?? undefined
		const readerZone = reader.timeZone ?? undefined
		// All-day and floating values encode wall-clock time as UTC; only the reader's "today" is read in their zone.
		const zone = when.allDay || when.floating ? 'UTC' : readerZone
		const day = this.dayPhrase(at, now, zone, readerZone, language, t)
		const clock = when.allDay ? t('All day') : this.clockPhrase(when, zone, language)
		// An all-day task due today reads "Due Today"; a timed one just "Due 10:00".
		const timing = when.due
			? t('Due ${when}', { when: (when.allDay ? [day || t('Today')] : [day, clock]).filter(Boolean).join(' ') })
			: [day, clock].filter(Boolean).join(' · ')
		return [timing, location].filter(Boolean).join(' · ')
	}

	/** The calendar URL with the entry's day and the entry selected, as the page writes it itself. */
	private link(timeZone: string | undefined): string {
		const { entry, when } = this.facts
		const at = ReminderNotification.anchorOf(when)
		if (!entry) {
			return '/'
		}
		const parameters = new URLSearchParams()
		if (at !== undefined) {
			parameters.set('date', dayOf(at, when!.allDay || when!.floating ? 'UTC' : timeZone))
		}
		parameters.set('selected', entry.id)
		return `/?${parameters}`
	}

	/** The due date for a due-only task, else the start. */
	private static anchorOf(when: PushWhen | undefined): number | undefined {
		return when === undefined ? undefined : when.due ? when.end : when.start ?? when.end
	}

	/** Empty for today, else "Tomorrow", "Yesterday" or the date. */
	private dayPhrase(at: number, now: number, zone: string | undefined, readerZone: string | undefined, language: string | undefined, t: Localize): string {
		const target = dayOf(at, zone)
		if (target === dayOf(now, readerZone)) {
			return ''
		}
		if (target === dayOf(now + DAY, readerZone)) {
			return t('Tomorrow')
		}
		if (target === dayOf(now - DAY, readerZone)) {
			return t('Yesterday')
		}
		return new Intl.DateTimeFormat(language, { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(at))
	}

	private clockPhrase(when: PushWhen, zone: string | undefined, language: string | undefined): string {
		const format = new Intl.DateTimeFormat(language, { timeZone: zone, hour: 'numeric', minute: '2-digit' })
		return when.start !== undefined && when.end !== undefined && when.end > when.start
			? format.formatRange(new Date(when.start), new Date(when.end))
			: format.format(new Date(ReminderNotification.anchorOf(when)!))
	}
}
