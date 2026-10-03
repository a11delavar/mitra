import { type EntityManager } from '@mikro-orm/core'
import { type DateTime } from '@3mo/date-time'
import ICAL from 'ical.js'
import { type RecurrenceScope } from '../Recurrence.js'
import { type Integration } from '../../../integrations/Integration.js'
import { type Source } from '../../sources/Source.js'
import { Entry, FLOATING_TIME_ZONE } from '../../entries/Entry.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { calendarDateOf, midnightOf } from '../../time/calendarDate.js'

/**
 * The occurrence domain of recurring series: everything between a stored MASTER row and its rendered
 * instances.
 *
 * **Read side** ({@link expandedOccurrences}): a series is a single master row; its occurrences are
 * expanded on demand into synthetic, never-persisted `Entry` objects, from the master's raw .ics when
 * the integration stores one (the .ics carries the authoritative anchor and EXDATEs), else from the
 * recurrence columns plus the `exdates` column. This needs ical.js's rule iterator, which is why it
 * lives here in the backend and not on the (frontend-bundled) `Recurrence` value object.
 *
 * **Write side** ({@link editOccurrence} / {@link deleteOccurrence}): RFC 5545 occurrence-editing
 * scopes, built from the integration's primitives so they work for both CalDAV (.ics) and Mitra's
 * own calendars:
 *  - **all**: shift the whole series to the edit (wall-clock in its own zone), adopt the edit's duration,
 *    and apply its other fields onto the master.
 *  - **following**: truncate the master to end before this occurrence, and start a new series at the edit.
 *  - **this**: detach this occurrence from the series (EXDATE) and add a standalone entry with the edit.
 *
 * "this" is deliberately a *detach* (a standalone entry), not a linked RECURRENCE-ID override: RFC 4791 forbids
 * the same UID in two resources and mitra stores one .ics per row, so a true override would need same-resource
 * multi-VEVENT sync. Detaching is RFC-safe and uniform; the trade-off is the occurrence no longer follows later
 * series-wide edits. (Inbound overrides authored by other clients still render via their synced override rows.)
 */

// --- Wall-clock ↔ instant, in an entry's own zone -----------------------------------------------------
// A series repeats at a WALL-CLOCK time in its `timeZone` ("every Monday 09:00 Berlin"): the rule must
// iterate wall times (09:00 stays 09:00 across a DST flip) while everything downstream needs instants.
// Temporal does the zone math; ical.js only ever sees FLOATING times.

/** The instant's wall-clock reading in `zone`, as a floating ical.js time: the anchor the iterator sees. */
function wallAnchor(instant: Date, zone: string): ICAL.Time {
	const zoned = Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(zone)
	return ICAL.Time.fromData({ year: zoned.year, month: zoned.month, day: zoned.day, hour: zoned.hour, minute: zoned.minute, second: zoned.second })
}

/** A yielded wall time back to an absolute instant in `zone`. `compatible` resolves DST gaps/overlaps
 * the way calendars conventionally do (spring-forward jumps ahead, fall-back takes the first). */
function wallToInstantMs(time: ICAL.Time, zone: string): number {
	return Temporal.PlainDateTime.from({ year: time.year, month: time.month, day: time.day, hour: time.hour, minute: time.minute, second: time.second })
		.toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds
}

/** An EXDATE value as the instant it excludes, decoded the same way the sync stores instants
 * ({@link CalDAV.instantFrom}, honoring the property's own TZID via Temporal), so exclusions always
 * land on the very instants `within` produces. A DATE (all-day) exclusion is that calendar day's
 * midnight in the series' day-math zone. */
function exdateMs(value: ICAL.Time, tzid: string | undefined, zone: string): number {
	return value.isDate ? wallToInstantMs(value, zone) : CalDAV.instantFrom(value, tzid)!.getTime()
}

/** The series MASTER among a parsed resource's components: the one WITHOUT a RECURRENCE-ID. A
 * resource bundles the master with its single-occurrence overrides (RFC 4791: one UID per resource)
 * in NO guaranteed document order. An override authored first would otherwise be mistaken for the
 * master, and the series (its RRULE and EXDATEs live on the real master) would silently not expand. */
function masterComponentOf(component: ICAL.Component): ICAL.Component | undefined {
	const subcomponents = [...component.getAllSubcomponents('vevent'), ...component.getAllSubcomponents('vtodo')]
	return subcomponents.find(sub => !sub.getFirstProperty('recurrence-id')) ?? subcomponents[0]
}

/** The zone a series' day math happens in, ALWAYS a real zone, so nothing about expansion, shifting
 * or excluding ever depends on where the container runs. An ALL-DAY series is a sequence of DATES
 * (canonical UTC-midnight encodings, see calendarDate.ts), so it iterates in UTC (pure date
 * arithmetic, no DST drift). A timed series repeats at a wall-clock time in its own `timeZone`. One
 * with NO authoring zone (a UTC-form DTSTART, which RFC 5545 §3.8.5.3 defines as recurring at fixed
 * UTC instants) or a FLOATING one (wall clock encoded as-if-UTC, see Entry.timeZone) reads its wall
 * clock in UTC, so both also iterate there: the same fixed-instant math on every server. (Formerly
 * these fell to a server-local legacy path, whose expansion silently depended on the container's TZ.) */
function dayMathZoneOf(master: Pick<Entry, 'allDay' | 'timeZone'>): string {
	return master.allDay || !master.timeZone || master.timeZone === FLOATING_TIME_ZONE ? 'UTC' : master.timeZone
}

/**
 * The occurrences of ONE recurring series: the iterable materialization of its rule. Constructed from
 * whatever the master actually stores ({@link Occurrences.of}): its raw .ics when the integration keeps
 * one (the .ics carries the authoritative rule and EXDATEs), else the recurrence columns plus the
 * `exdates` column. A window then materializes the intersecting date-ranges via {@link within}. A
 * never-ending series stays finite because the window bounds it.
 *
 * Iteration is ALWAYS wall-clock in the series' day-math zone ({@link dayMathZoneOf}), anchored on the
 * master's start read in it: a 09:00-Berlin series stays 09:00 through DST, and a zone-less (UTC-form)
 * one repeats at fixed UTC instants, on any server.
 */
export class Occurrences {
	private constructor(
		private readonly rule: ICAL.Recur,
		private readonly anchor: ICAL.Time,
		private readonly durationMs: number,
		private readonly exdates: ReadonlySet<number>,
		private readonly zone: string,
	) { }

	/** The series' occurrences off a master entry, however it stores its rule; `undefined` when the
	 * entry isn't an expandable master (no rule, no start, or a malformed stored rule). The master's
	 * `timeZone` (stamped at creation, or synced from a TZID) makes the iteration wall-clock in it;
	 * none (and the floating marker, which must never reach Temporal/Intl) means UTC. See
	 * {@link dayMathZoneOf}. */
	static of(master: Entry): Occurrences | undefined {
		// An unscheduled task repeats its due.
		const anchor = (master.start ?? master.due) as Date | undefined
		if (!anchor) {
			return undefined // no anchor to expand from
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

	/**
	 * From a raw .ics: applies its EXDATEs and inherits the master's duration (DTEND/DUE − DTSTART unless
	 * `durationMs` says otherwise). Works for VEVENT and VTODO (anchored on DTSTART, else DUE). With a
	 * `zone`, the anchor is the master's start read in it, since the stored DTSTART may be UTC-written,
	 * whose wall clock would drift; without one (a direct call), the anchor is the DTSTART's own instant
	 * read in UTC. All property values decode via {@link CalDAV.instantFrom}, so a TZID resolves through
	 * Temporal whether or not the resource embeds its VTIMEZONE.
	 */
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

	/** The anchor instant with a zone that actually resolves: a stored `timeZone` that Temporal can't
	 * read (a Microsoft zone name synced before ids were sanitized, say) falls back to UTC: fixed
	 * instants beat a crashed read for every series in the window. */
	private static anchorOf(instant: Date, zone: string): [Date, string] {
		try {
			Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone)
			return [instant, zone]
		} catch {
			return [instant, 'UTC']
		}
	}

	/**
	 * From DB columns (rrule string + start/end + excluded epoch-ms), with no raw .ics. Integrations
	 * that don't persist one (e.g. a Mitra calendar) expand this way; `exdates` carries that
	 * calendar's exclusions (its EXDATE equivalent).
	 */
	static fromRule(rrule: string, start: Date, end: Date | undefined, exdates: ReadonlyArray<number> = [], zone = 'UTC'): Occurrences | undefined {
		let rule: ICAL.Recur
		try {
			rule = ICAL.Recur.fromString(rrule)
		} catch {
			return undefined // malformed rule: render nothing rather than throw on a read
		}
		if (!rule.freq) {
			return undefined
		}
		const [anchorInstant, anchorZone] = Occurrences.anchorOf(start, zone)
		return new Occurrences(rule, wallAnchor(anchorInstant, anchorZone), end ? end.getTime() - start.getTime() : 0, new Set(exdates), anchorZone)
	}

	/** The occurrence date-ranges intersecting [windowStart, windowEnd]. The rule's occurrences ascend
	 * from the anchor, so iteration stops once past the window; `maxIterations` is only a backstop for
	 * a pathological/non-advancing rule and is generous: a far-future window must still be reachable
	 * for a dense series (a daily one needs one iteration per day from the anchor to the window). */
	/** How many RULE-GENERATED occurrences fall strictly before `instant`: the COUNT bookkeeping of a
	 * "this and following" split. Deliberately blind to EXDATEs: RFC 5545's COUNT bounds the rule's
	 * generation BEFORE exclusions prune the set, so an excluded instance still consumes count. */
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
				break // non-advancing (malformed) or past the split, since occurrences ascend
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
			// A wall time in the series' zone becomes an instant THERE (UTC ⇒ the fixed-instant case).
			const startMs = wallToInstantMs(time, this.zone)
			if (startMs <= previousMs) {
				break // a non-advancing iterator (malformed rule), so don't spin
			}
			previousMs = startMs
			if (startMs > windowEndMs) {
				break // occurrences ascend; nothing further can intersect the window
			}
			if (startMs + this.durationMs < windowStartMs || this.exdates.has(startMs)) {
				continue
			}
			occurrences.push({ start: new Date(startMs), end: new Date(startMs + this.durationMs) })
		}
		return occurrences
	}
}

/**
 * The rendered occurrences of every recurring master among `sourceIds` that intersect the window, as
 * synthetic entries. Masters are loaded regardless of date (a master's DTSTART may be far before the
 * window); occurrence dates that already have an override row are skipped, so a customised instance
 * (fetched as a plain row) isn't duplicated by a default one. Given the viewer's zone, a series with no
 * start yields its {@link currentOccurrence} instead, whatever the window.
 */
export async function expandedOccurrences(em: EntityManager, sourceIds: ReadonlyArray<string>, windowStart: Date, windowEnd: Date, viewerZone?: string): Promise<Array<Entry>> {
	const masters = await em.find(Entry, { sourceId: { $in: [...sourceIds] }, recurrence: { freq: { $ne: null } } })
	const overrides = masters.length
		? await em.find(Entry, { recurrenceMasterId: { $in: masters.map(master => master.id!) } })
		: []
	const overridden = new Set(overrides.map(override => `${override.recurrenceMasterId}|${override.recurrenceId?.valueOf()}`))

	return masters.flatMap(master => {
		const ranges = !master.start && viewerZone
			? [currentOccurrence(master, viewerZone)].filter(range => !!range)
			: Occurrences.of(master)?.within(windowStart, windowEnd) ?? []
		return ranges
			.filter(occurrence => !overridden.has(`${master.id}|${occurrence.start.valueOf()}`))
			.map(occurrence => occurrenceOf(master, occurrence))
	})
}

/**
 * The occurrence of a series with no start that the viewer has to do next: the first whose due day has not gone by
 * in `zone`. Such a series is on no grid, only in the planning list. All-day dues are canonical UTC midnights, so
 * today is measured as one too.
 */
export function currentOccurrence(master: Entry, zone: string, now = new Date()): { start: Date, end: Date } | undefined {
	const today = midnightOf(calendarDateOf(now, zone), master.allDay ? 'UTC' : zone)
	return Occurrences.of(master)?.next(today, 1)[0]
}

/** Every series once, as the occurrence it starts on: a whole-series edit, move or delete goes through it as through any other. */
export async function seriesStarts(em: EntityManager, sourceIds: ReadonlyArray<string>): Promise<Array<Entry>> {
	const masters = await em.find(Entry, { sourceId: { $in: [...sourceIds] }, recurrence: { freq: { $ne: null } } })
	return masters.filter(master => !!(master.start ?? master.due)).map(master => occurrenceOf(master, { start: (master.start ?? master.due)!, end: master.end }))
}

/** One occurrence of `master` at the instant its rule yields: the start, or the due of an unscheduled series. The due keeps its exact offset from the start, as the end does (RFC 5545 §3.8.5.3). */
export function occurrenceOf(master: Entry, occurrence: { readonly start: Date, readonly end?: Date }) {
	const scheduled = !!master.start
	const dueOffset = master.due && master.start ? master.due.valueOf() - master.start.valueOf() : 0
	return new Entry({
		// Stable, CSS-ident-safe id per occurrence (the master id + the instant in ms): unique render
		// key for anchor-name/view-transition-name; edits route to the master via recurrenceMasterId.
		id: `${master.id}__${occurrence.start.getTime()}`,
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
		start: scheduled ? occurrence.start as DateTime : undefined,
		end: scheduled && master.end ? occurrence.end as DateTime : undefined,
		due: master.due ? new Date(occurrence.start.valueOf() + dueOffset) as DateTime : undefined,
		estimate: master.estimate,
		uid: master.uid,
		recurrence: master.recurrence,
		recurrenceMasterId: master.id,
		recurrenceId: occurrence.start as DateTime,
		seriesStart: master.start ?? master.due,
	})
}

// --- Write side: scoped edits -----------------------------------------------------------------------

/** Shift one instant the way the series' occurrences shift when an edit moves the anchor `from` → `to`:
 * in the master's wall-clock zone, mirroring `within`: a 09:00 stays a 09:00 across a DST flip. For a
 * zone-less series ({@link dayMathZoneOf} ⇒ UTC, which has no DST) this reduces to the plain instant
 * delta, exactly as such fixed-instant series move. */
function shiftMs(ms: number, zone: string, from: Date, to: Date): number {
	const wall = (value: number) => Temporal.Instant.fromEpochMilliseconds(value).toZonedDateTimeISO(zone).toPlainDateTime()
	const delta = wall(from.getTime()).until(wall(to.getTime()))
	return wall(ms).add(delta).toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds
}

/** A master's excluded instants (epoch-ms), from wherever it stores them: the raw .ics EXDATEs when
 * the integration keeps one (the same authority the expansion reads), else the `exdates` column. */
export function exdatesOf(master: Entry): Array<number> {
	if (master.data?.raw) {
		const component = new ICAL.Component(ICAL.parse(master.data.raw))
		const v = masterComponentOf(component)
		return !v ? [] : v.getAllProperties('exdate').flatMap(prop => prop.getValues().map(value => exdateMs(value as ICAL.Time, prop.getParameter('tzid')?.toString(), dayMathZoneOf(master))))
	}
	return master.exdates ?? []
}

/** The exclusions shift exactly like the occurrences they stand for ({@link shiftMs}). Matched by
 * instant, one left behind by a series-wide move matches nothing afterwards, and the detached
 * occurrence it stood for reappears at the shifted slot, doubled next to its detached copy. */
function shiftExdates(exdates: Array<number>, zone: string, from: Date, to: Date): Array<number> {
	return exdates.map(ms => shiftMs(ms, zone, from, to))
}

/** Target destination when a scoped edit moves the resulting entry/series to another source. */
export interface OccurrenceTarget {
	readonly source: Source
	readonly integration: Integration
}

/**
 * Apply an occurrence edit to `master` at `recurrenceId`.
 * If `movingTo` is specified, the created entry/series is created in the target source.
 */
export async function editOccurrence(em: EntityManager, integration: Integration, master: Entry, recurrenceId: Date, edited: Entry, scope: RecurrenceScope, movingTo?: OccurrenceTarget): Promise<Entry> {
	const into = movingTo?.integration ?? integration
	const intoSourceId = movingTo?.source.id ?? master.sourceId
	if (scope === 'all') {
		// What the rule iterates: the start, or the due of an unscheduled series.
		const editedAnchor = (master.start ? edited.start : edited.due) ?? edited.start ?? edited.due
		const editedStart = new Date(editedAnchor?.getTime() ?? recurrenceId.getTime())
		const exdates = exdatesOf(master)
		// The anchor shifts the way the occurrences read: wall-clock in the series' own zone ({@link
		// shiftMs}), so a drag expressed at THIS occurrence can't beach the anchor (and with it every
		// occurrence) an hour off across a DST flip the anchor straddles but the occurrence doesn't.
		const masterAnchor = master.start ?? master.due
		const anchor = masterAnchor === undefined ? undefined
			: new Date(shiftMs(masterAnchor.getTime(), dayMathZoneOf(master), recurrenceId, editedStart)) as DateTime
		const start = master.start ? anchor : undefined
		// The due keeps the offset from the anchor the edit gave it.
		const due = !edited.due || !anchor ? undefined : new Date(anchor.getTime() + edited.due.getTime() - editedStart.getTime()) as DateTime
		// The span adopts the edit's DURATION rather than shifting the stored end by the start's delta:
		// that would carry the master's old length over the edit, silently dropping a resize and turning
		// an all-day ↔ timed conversion into a day-long timed entry (or a few-hours "all-day" one).
		const durationMs = edited.start && edited.end ? edited.end.getTime() - edited.start.getTime()
			: master.start && master.end ? master.end.getTime() - master.start.getTime() : undefined
		const incoming = new Entry({
			sourceId: master.sourceId,
			type: master.type,
			heading: edited.heading,
			description: edited.description,
			location: edited.location,
			color: edited.color ?? null,
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
			estimate: start ? null : edited.estimate,
			// The rule follows the shift (a weekly-Monday series moved a day later becomes weekly-Tuesday);
			// a rule left mismatching its shifted anchor would silently lose the anchor's own occurrence.
			recurrence: master.recurrence!.rebased(recurrenceId, editedStart, dayMathZoneOf(master)),
			// The exclusions follow it too (see shiftExdates); absent means "keep" to the integration.
			exdates: exdates.length ? shiftExdates(exdates, dayMathZoneOf(master), recurrenceId, editedStart) : undefined,
			uid: master.uid,
		})
		if (!movingTo) {
			await integration.updateEntry(em, master, incoming)
			return master
		}
		// Moving full series across sources: recreate in target first (preserving UID, rule, exclusions), then delete original.
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
		// Capture the rule (and the count its old half consumes) BEFORE truncating the master
		// (updateEntry mutates master.recurrence, and the raw .ics this counting reads, in place).
		const rule = master.recurrence!
		const consumed = rule.count ? Occurrences.of(master)?.generatedBefore(recurrenceId) ?? 0 : 0
		// Old half: same details, rule truncated to end before this occurrence.
		const truncated = new Entry({
			sourceId: master.sourceId,
			type: master.type,
			heading: master.heading,
			description: master.description,
			location: master.location,
			color: master.color ?? null,
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
		// New half: a fresh series (new UID) starting at the edit, continuing the original cadence, with
		// the rule rebased onto the edit's day, so the new anchor (possibly dragged to another weekday)
		// still matches it and renders as the continuation's first occurrence.
		const continuationStart = new Date((master.start ? edited.start : edited.due)?.getTime() ?? recurrenceId.getTime())
		// The continuation half also inherits its half of the exclusions (shifted like its occurrences):
		// created without them, a previously detached occurrence past the split would render doubled.
		const carried = exdatesOf(master).filter(ms => ms >= recurrenceId.getTime())
		const continuation = new Entry({
			id: crypto.randomUUID(),
			uid: crypto.randomUUID(), // a fresh series is a fresh identity, relatable from birth (a Mitra calendar has no .ics to mint one from)
			sourceId: intoSourceId,
			type: master.type,
			heading: edited.heading,
			description: edited.description,
			location: edited.location,
			color: edited.color ?? null,
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

	// 'this': detach this occurrence into a standalone entry.
	await integration.excludeOccurrence(em, master, recurrenceId)
	const standalone = new Entry({
		id: crypto.randomUUID(),
		uid: crypto.randomUUID(), // detached = its own identity, deliberately NOT the master's (one UID per series)
		sourceId: intoSourceId,
		type: master.type,
		heading: edited.heading,
		description: edited.description,
		location: edited.location,
		color: edited.color ?? null,
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

/** Delete an occurrence at `recurrenceId` from `master` with the given scope. */
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
			color: master.color ?? null,
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
