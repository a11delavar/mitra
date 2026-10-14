import { type EntityManager } from '@mikro-orm/core'
import { type DateTime } from '@3mo/date-time'
import ICAL from 'ical.js'
import { type RecurrenceScope } from '../Recurrence.js'
import { type Integration } from '../../../integrations/Integration.js'
import { type Source } from '../../sources/Source.js'
import { Entry } from '../../entries/Entry.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { TimeZone } from '../../time/TimeZone.js'

/*
	A series is one master row, expanded on read into entries that are never stored. An edit of 'this' occurrence
	detaches it into an entry of its own rather than a RECURRENCE-ID override: RFC 4791 keeps one UID to a resource,
	and Mitra stores one .ics per row. Overrides other clients wrote still render from their own rows.
*/

// A series repeats at a wall-clock time in its zone, 09:00 staying 09:00 across DST: ical.js iterates floating
// times and Temporal turns them into instants.

function wallAnchor(instant: Date, zone: string): ICAL.Time {
	const zoned = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone)
	return ICAL.Time.fromData({ year: zoned.year, month: zoned.month, day: zoned.day, hour: zoned.hour, minute: zoned.minute, second: zoned.second })
}

/** `compatible` resolves a DST gap forward and an overlap to its first reading, as calendars do. */
function wallToInstantMs(time: ICAL.Time, zone: string): number {
	return Temporal.PlainDateTime.from({ year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second })
		.toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds
}

/** Decoded as the sync stores instants, so an exclusion lands on the very instant `within` yields. */
function exdateMs(value: ICAL.Time, tzid: string | undefined, zone: string): number {
	return value.isDate ? wallToInstantMs(value, zone) : CalDAV.instantFrom(value, tzid)!.getTime()
}

/** The component without a RECURRENCE-ID: a resource lists its overrides in no guaranteed order, master first or not. */
function masterComponentOf(component: ICAL.Component): ICAL.Component | undefined {
	const subcomponents = [...component.getAllSubcomponents('vevent'), ...component.getAllSubcomponents('vtodo')]
	return subcomponents.find(sub => !sub.getFirstProperty('recurrence-id')) ?? subcomponents[0]
}

/**
 * Always a real zone, never the server's. All-day dates are UTC midnights, and a series without a zone (a UTC
 * DTSTART recurs at fixed instants, RFC 5545 §3.8.5.3) or a floating one iterates in UTC too.
 */
function dayMathZoneOf(master: Pick<Entry, 'allDay' | 'timeZone'>): string {
	return master.allDay || !master.timeZone ? 'UTC' : master.timeZone.clock
}

/** One series' occurrences, from its raw .ics where the integration keeps one, else its columns. */
export class Occurrences {
	private constructor(
		private readonly rule: ICAL.Recur,
		private readonly anchor: ICAL.Time,
		private readonly durationMs: number,
		private readonly exdates: ReadonlySet<number>,
		private readonly zone: string,
	) { }

	/** `undefined` for an entry that isn't an expandable master. */
	static of(master: Entry): Occurrences | undefined {
		// An unscheduled task repeats its due.
		const anchor = (master.start ?? master.due) as Date | undefined
		if (!anchor) {
			return undefined
		}
		const zone = { id: dayMathZoneOf(master), start: anchor }
		// The span as the sync read it: a task's DUE is no longer necessarily its end.
		const durationMs = master.start && master.end ? master.end.valueOf() - master.start.valueOf() : 0
		if (master.data?.raw) {
			return Occurrences.fromICS(master.data.raw, zone, durationMs)
		}
		return !master.recurrence ? undefined : Occurrences.fromRule(
			master.recurrence.toRRule(master.allDay),
			anchor,
			master.start ? master.end as Date | undefined : undefined,
			master.exdates ?? [],
			zone.id,
		)
	}

	/** With a `zone`, the anchor is the master's start read there, as a UTC-written DTSTART's wall clock would drift. */
	static fromICS(raw: string, zone?: { id: string, start: Date }, durationMs?: number): Occurrences | undefined {
		const component = new ICAL.Component(ICAL.parse(raw))
		const v = masterComponentOf(component)
		const rrule = v?.getFirstPropertyValue('rrule') as ICAL.Recur | null
		const dtstart = (v?.getFirstPropertyValue('dtstart') ?? v?.getFirstPropertyValue('due')) as ICAL.Time | null
		if (!v || !rrule || !dtstart) {
			return undefined
		}

		const tzidOf = (name: string) => v.getFirstProperty(name)?.getParameter('tzid')?.toString()
		const startInstant = CalDAV.instantFrom(dtstart, v.getFirstProperty('dtstart') ? tzidOf('dtstart') : tzidOf('due'))!
		const endProp = (v.getFirstPropertyValue('dtend') ?? v.getFirstPropertyValue('due')) as ICAL.Time | null
		const endInstant = !endProp ? undefined : CalDAV.instantFrom(endProp, tzidOf('dtend') ?? tzidOf('due') ?? tzidOf('dtstart'))

		const [anchorInstant, anchorZone] = Occurrences.anchorOf(zone?.start ?? startInstant, zone?.id ?? 'UTC')

		const exdates = new Set<number>()
		for (const prop of v.getAllProperties('exdate')) {
			for (const value of prop.getValues()) {
				exdates.add(exdateMs(value as ICAL.Time, prop.getParameter('tzid')?.toString(), anchorZone))
			}
		}

		return new Occurrences(rrule, wallAnchor(anchorInstant, anchorZone), durationMs ?? (endInstant ? endInstant.getTime() - startInstant.getTime() : 0), exdates, anchorZone)
	}

	/** A zone Temporal can't read (a Microsoft name synced long ago) falls back to UTC rather than failing the window. */
	private static anchorOf(instant: Date, zone: string): [Date, string] {
		try {
			Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone)
			return [instant, zone]
		} catch {
			return [instant, 'UTC']
		}
	}

	static fromRule(rrule: string, start: Date, end: Date | undefined, exdates: ReadonlyArray<number> = [], zone = 'UTC'): Occurrences | undefined {
		let rule: ICAL.Recur
		try {
			rule = ICAL.Recur.fromString(rrule)
		} catch {
			return undefined
		}
		if (!rule.freq) {
			return undefined
		}
		const [anchorInstant, anchorZone] = Occurrences.anchorOf(start, zone)
		return new Occurrences(rule, wallAnchor(anchorInstant, anchorZone), end ? end.getTime() - start.getTime() : 0, new Set(exdates), anchorZone)
	}

	/** Blind to exclusions, as RFC 5545 counts COUNT before EXDATEs prune the set. */
	generatedBefore(instant: Date, maxIterations = 100_000): number {
		const iterator = this.rule.iterator(this.anchor)
		const boundMs = instant.getTime()
		let generated = 0
		let previousMs = -Infinity
		for (let i = 0; i < maxIterations; i++) {
			const time = iterator.next()
			if (!time) {
				break
			}
			const startMs = wallToInstantMs(time, this.zone)
			if (startMs <= previousMs || startMs >= boundMs) {
				break
			}
			previousMs = startMs
			generated++
		}
		return generated
	}

	/** The first `count` occurrences starting at or after `after`, for a series no window shows. */
	next(after: Date, count: number, maxIterations = 100_000): Array<{ start: Date, end: Date }> {
		const occurrences = new Array<{ start: Date, end: Date }>()
		const iterator = this.rule.iterator(this.anchor)
		let previousMs = -Infinity
		for (let i = 0; i < maxIterations && occurrences.length < count; i++) {
			const time = iterator.next()
			if (!time) {
				break
			}
			const startMs = wallToInstantMs(time, this.zone)
			if (startMs <= previousMs) {
				break
			}
			previousMs = startMs
			if (startMs >= after.getTime() && !this.exdates.has(startMs)) {
				occurrences.push({ start: new Date(startMs), end: new Date(startMs + this.durationMs) })
			}
		}
		return occurrences
	}

	/** The occurrence in progress or next to come, else the last; `skip` passes over overridden starts. */
	nearest(instant: Date, skip: (startMs: number) => boolean = () => false, maxIterations = 100_000): { start: Date, end: Date } | undefined {
		const iterator = this.rule.iterator(this.anchor)
		const instantMs = instant.getTime()
		let previousMs = -Infinity
		let nearest: { start: Date, end: Date } | undefined
		for (let i = 0; i < maxIterations; i++) {
			const time = iterator.next()
			if (!time) {
				break
			}
			const startMs = wallToInstantMs(time, this.zone)
			if (startMs <= previousMs) {
				break
			}
			previousMs = startMs
			if (this.exdates.has(startMs) || skip(startMs)) {
				continue
			}
			nearest = { start: new Date(startMs), end: new Date(startMs + this.durationMs) }
			if (startMs + this.durationMs >= instantMs) {
				break
			}
		}
		return nearest
	}

	within(windowStart: Date, windowEnd: Date, maxIterations = 100_000): Array<{ start: Date, end: Date }> {
		const occurrences = new Array<{ start: Date, end: Date }>()
		const iterator = this.rule.iterator(this.anchor)
		const windowStartMs = windowStart.getTime()
		const windowEndMs = windowEnd.getTime()
		let previousMs = -Infinity
		for (let i = 0; i < maxIterations; i++) {
			const time = iterator.next()
			if (!time) {
				break
			}
			const startMs = wallToInstantMs(time, this.zone)
			if (startMs <= previousMs) {
				break
			}
			previousMs = startMs
			if (startMs > windowEndMs) {
				break
			}
			if (startMs + this.durationMs < windowStartMs || this.exdates.has(startMs)) {
				continue
			}
			occurrences.push({ start: new Date(startMs), end: new Date(startMs + this.durationMs) })
		}
		return occurrences
	}
}

/** Every series' occurrences in the window, its overridden dates left to their own rows; a start-less one yields its {@link currentOccurrence}. */
export async function expandedOccurrences(em: EntityManager, sourceIds: ReadonlyArray<string>, windowStart: Date, windowEnd: Date, viewerZone?: string): Promise<Array<Entry>> {
	const masters = await em.find(Entry, { sourceId: { $in: [...sourceIds] }, recurrence: { freq: { $ne: null } } })
	const overridden = await overriddenOf(em, masters)

	return masters.flatMap(master => {
		const ranges = !master.start && viewerZone
			? [currentOccurrence(master, viewerZone)].filter(range => !!range)
			: Occurrences.of(master)?.within(windowStart, windowEnd) ?? []
		return ranges
			.filter(occurrence => !overridden.has(`${master.id}|${occurrence.start.valueOf()}`))
			.map(occurrence => occurrenceOf(master, occurrence))
	})
}

/** A start-less series' occurrence the viewer has to do next: the first whose due day has not gone by in `zone`. */
export function currentOccurrence(master: Entry, zone: string, now = new Date()): { start: Date, end: Date } | undefined {
	const here = TimeZone.of(zone)
	const today = (master.allDay ? TimeZone.UTC : here).midnightOf(here.dayOf(now))
	return Occurrences.of(master)?.next(today, 1)[0]
}

/** Every series once, as the occurrence it starts on: a whole-series edit, move or delete goes through it as through any other. */
export async function seriesStarts(em: EntityManager, sourceIds: ReadonlyArray<string>): Promise<Array<Entry>> {
	const masters = await em.find(Entry, { sourceId: { $in: [...sourceIds] }, recurrence: { freq: { $ne: null } } })
	return masters.filter(master => !!(master.start ?? master.due)).map(master => occurrenceOf(master, { start: (master.start ?? master.due)!, end: master.end }))
}

/** Each series as the occurrence standing for it at `now`, under the id the window mints: an editor intent naming the master would be taken by whichever occurrence renders first. */
export async function nearestOccurrence(em: EntityManager, entries: ReadonlyArray<Entry>, viewerZone: string, now: Date): Promise<Array<Entry>> {
	const overridden = await overriddenOf(em, entries.filter(entry => entry.recurrence?.freq))
	return entries.map(entry => {
		const skip = (startMs: number) => overridden.has(`${entry.id}|${startMs}`)
		const occurrence = !entry.recurrence?.freq ? undefined
			: !entry.start ? [currentOccurrence(entry, viewerZone, now)].find(range => range && !skip(range.start.valueOf()))
				: Occurrences.of(entry)?.nearest(now, skip)
		return occurrence ? occurrenceOf(entry, occurrence) : entry
	})
}

/** `masterId|recurrenceIdMs` of every override row, whose dates the masters' expansion leaves out. */
async function overriddenOf(em: EntityManager, masters: ReadonlyArray<Entry>) {
	const overrides = masters.length
		? await em.find(Entry, { recurringEntryId: { $in: masters.map(master => master.id!) } })
		: []
	return new Set(overrides.map(override => `${override.recurringEntryId}|${override.recurrenceId?.valueOf()}`))
}

/** One occurrence of `master` at the instant its rule yields: the start, or the due of an unscheduled series. The due keeps its exact offset from the start, as the end does (RFC 5545 §3.8.5.3). */
export function occurrenceOf(master: Entry, occurrence: { readonly start: Date, readonly end?: Date }) {
	const scheduled = !!master.start
	const dueOffset = master.due && master.start ? master.due.valueOf() - master.start.valueOf() : 0
	return new Entry({
		// CSS-ident-safe, as anchor and view-transition names take it.
		id: `${master.id}__${occurrence.start.getTime()}`,
		sourceId: master.sourceId,
		type: master.type,
		heading: master.heading,
		description: master.description,
		location: master.location,
		color: master.color,
		status: master.status,
		percentComplete: master.percentComplete,
		rank: master.rank,
		transparency: master.transparency,
		visibility: master.visibility,
		allDay: master.allDay,
		timeZone: master.timeZone,
		reminders: master.reminders,
		participants: master.participants,
		start: scheduled ? occurrence.start as DateTime : undefined,
		end: scheduled && master.end ? occurrence.end as DateTime : undefined,
		due: master.due ? new Date(occurrence.start.valueOf() + dueOffset) as DateTime : undefined,
		estimate: master.estimate,
		uid: master.uid,
		recurrence: master.recurrence,
		recurringEntryId: master.id,
		recurrenceId: occurrence.start as DateTime,
		seriesStart: master.start ?? master.due,
	})
}

/** The occurrence `master` expands to at `recurrenceId`, each lasting as long as the master does. */
export function occurrenceAt(master: Entry, recurrenceId: Date) {
	const span = master.start && master.end ? master.end.getTime() - master.start.getTime() : undefined
	return occurrenceOf(master, { start: recurrenceId, end: span === undefined ? undefined : new Date(recurrenceId.getTime() + span) })
}

/** A series edit that leaves its rule nothing to repeat from. */
export class AnchorlessSeriesError extends Error {
	readonly status = 400

	constructor() {
		super('A repeating entry cannot lose the date it repeats from')
	}
}

/** Shifts an instant as the occurrences shift, by wall clock in the series' zone. */
function shiftMs(ms: number, zone: string, from: Date, to: Date): number {
	const wall = (value: number) => Temporal.Instant.fromEpochMilliseconds(value).toZonedDateTimeISO(zone).toPlainDateTime()
	const delta = wall(from.getTime()).until(wall(to.getTime()))
	return wall(ms).add(delta).toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds
}

export function exdatesOf(master: Entry): Array<number> {
	if (master.data?.raw) {
		const component = new ICAL.Component(ICAL.parse(master.data.raw))
		const v = masterComponentOf(component)
		return !v ? [] : v.getAllProperties('exdate').flatMap(prop => prop.getValues().map(value => exdateMs(value as ICAL.Time, prop.getParameter('tzid')?.toString(), dayMathZoneOf(master))))
	}
	return master.exdates ?? []
}

/** Matched by instant, an exclusion left behind by a move would bring back the occurrence it hid beside its detached copy. */
function shiftExdates(exdates: Array<number>, zone: string, from: Date, to: Date): Array<number> {
	return exdates.map(ms => shiftMs(ms, zone, from, to))
}

export interface OccurrenceTarget {
	readonly source: Source
	readonly integration: Integration
}

export async function editOccurrence(em: EntityManager, integration: Integration, master: Entry, recurrenceId: Date, edited: Entry, scope: RecurrenceScope, movingTo?: OccurrenceTarget): Promise<Entry> {
	const into = movingTo?.integration ?? integration
	const intoSourceId = movingTo?.source.id ?? master.sourceId
	// What the rule iterates: the start, or the due of an unscheduled series. Only 'this' may drop it, as its occurrence leaves the series.
	const editedAnchor = master.start ? edited.start : edited.due
	if (scope !== 'this' && !editedAnchor) {
		throw new AnchorlessSeriesError()
	}
	if (scope === 'all') {
		const editedStart = new Date(editedAnchor!.getTime())
		const exdates = exdatesOf(master)
		// By wall clock, or a DST flip between the anchor and this occurrence would leave every occurrence an hour off.
		const masterAnchor = master.start ?? master.due
		const anchor = masterAnchor === undefined ? undefined
			: new Date(shiftMs(masterAnchor.getTime(), dayMathZoneOf(master), recurrenceId, editedStart)) as DateTime
		const start = master.start ? anchor : undefined
		// The due keeps the offset from the anchor the edit gave it.
		const due = !edited.due || !anchor ? undefined : new Date(anchor.getTime() + edited.due.getTime() - editedStart.getTime()) as DateTime
		// The edit's duration, not the master's: shifting the old end would drop a resize. No end makes a moment series.
		const durationMs = edited.start ? (edited.end ? edited.end.getTime() - edited.start.getTime() : undefined)
			: master.start && master.end ? master.end.getTime() - master.start.getTime() : undefined
		const incoming = new Entry({
			sourceId: master.sourceId,
			type: master.type,
			heading: edited.heading,
			description: edited.description,
			location: edited.location,
			color: edited.color,
			status: edited.status,
			percentComplete: edited.percentComplete,
			transparency: edited.transparency,
			visibility: edited.visibility,
			allDay: edited.allDay,
			timeZone: edited.timeZone,
			reminders: edited.reminders,
			participants: edited.participants,
			start,
			end: start === undefined || durationMs === undefined ? undefined : new Date(start.getTime() + durationMs) as DateTime,
			due,
			estimate: start ? undefined : edited.estimate,
			recurrence: master.recurrence!.rebased(recurrenceId, editedStart, dayMathZoneOf(master)),
			// Absent exclusions mean "keep" to the integration.
			exdates: exdates.length ? shiftExdates(exdates, dayMathZoneOf(master), recurrenceId, editedStart) : undefined,
			uid: master.uid,
		})
		if (!movingTo) {
			await integration.updateEntry(em, master, incoming)
			return master
		}
		// Create first, so a failure loses nothing.
		const moved = new Entry({ ...incoming, id: crypto.randomUUID(), sourceId: movingTo.source.id, uid: master.uid })
		const created = await movingTo.integration.createEntry(em, moved)
		try {
			await integration.deleteEntry(em, master)
		} catch (error) {
			await movingTo.integration.deleteEntry(em, created).catch(() => void 0)
			throw error
		}
		return created
	}

	if (scope === 'following') {
		// Before the truncation, which rewrites the rule and the raw .ics this counts.
		const rule = master.recurrence!
		const consumed = rule.count ? Occurrences.of(master)?.generatedBefore(recurrenceId) ?? 0 : 0
		const truncated = new Entry({
			sourceId: master.sourceId,
			type: master.type,
			heading: master.heading,
			description: master.description,
			location: master.location,
			color: master.color,
			status: master.status,
			percentComplete: master.percentComplete,
			transparency: master.transparency,
			visibility: master.visibility,
			allDay: master.allDay,
			timeZone: master.timeZone,
			reminders: master.reminders,
			participants: master.participants,
			start: master.start,
			end: master.end,
			due: master.due,
			estimate: master.estimate,
			recurrence: rule.endingBefore(recurrenceId),
			uid: master.uid,
		})
		await integration.updateEntry(em, master, truncated)
		const continuationStart = new Date(editedAnchor!.getTime())
		// Without its exclusions, an occurrence detached past the split would render twice.
		const carried = exdatesOf(master).filter(ms => ms >= recurrenceId.getTime())
		const continuation = new Entry({
			id: crypto.randomUUID(),
			uid: crypto.randomUUID(),
			sourceId: intoSourceId,
			type: master.type,
			heading: edited.heading,
			description: edited.description,
			location: edited.location,
			color: edited.color,
			status: edited.status,
			percentComplete: edited.percentComplete,
			transparency: edited.transparency,
			visibility: edited.visibility,
			allDay: edited.allDay,
			timeZone: edited.timeZone,
			reminders: edited.reminders,
			participants: edited.participants,
			start: edited.start,
			end: edited.end,
			due: edited.due,
			estimate: edited.estimate,
			recurrence: rule.asContinuation(consumed).rebased(recurrenceId, continuationStart, dayMathZoneOf(master)),
			exdates: carried.length ? shiftExdates(carried, dayMathZoneOf(master), recurrenceId, continuationStart) : undefined,
		})
		return into.createEntry(em, continuation)
	}

	await integration.excludeOccurrence(em, master, recurrenceId)
	const standalone = new Entry({
		id: crypto.randomUUID(),
		uid: crypto.randomUUID(),
		sourceId: intoSourceId,
		type: master.type,
		heading: edited.heading,
		description: edited.description,
		location: edited.location,
		color: edited.color,
		status: edited.status,
		percentComplete: edited.percentComplete,
		transparency: edited.transparency,
		visibility: edited.visibility,
		allDay: edited.allDay,
		timeZone: edited.timeZone,
		reminders: edited.reminders,
		participants: edited.participants,
		start: edited.start,
		end: edited.end,
		due: edited.due,
		estimate: edited.estimate,
	})
	return into.createEntry(em, standalone)
}

export async function deleteOccurrence(em: EntityManager, integration: Integration, master: Entry, recurrenceId: Date, scope: RecurrenceScope): Promise<void> {
	if (scope === 'all') {
		await integration.deleteEntry(em, master)
		return
	}

	if (scope === 'following') {
		const truncated = new Entry({
			sourceId: master.sourceId,
			type: master.type,
			heading: master.heading,
			description: master.description,
			location: master.location,
			color: master.color,
			status: master.status,
			percentComplete: master.percentComplete,
			transparency: master.transparency,
			visibility: master.visibility,
			allDay: master.allDay,
			timeZone: master.timeZone,
			reminders: master.reminders,
			participants: master.participants,
			start: master.start,
			end: master.end,
			due: master.due,
			estimate: master.estimate,
			recurrence: master.recurrence!.endingBefore(recurrenceId),
			uid: master.uid,
		})
		await integration.updateEntry(em, master, truncated)
		return
	}

	// 'this'
	await integration.excludeOccurrence(em, master, recurrenceId)
}
