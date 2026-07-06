import { type EntityManager } from '@mikro-orm/core'
import { type DateTime } from '@3mo/date-time'
import ICAL from 'ical.js'
import { Entry, type Integration, type RecurrenceScope } from '../shared/index.js'

/**
 * The occurrence domain of recurring series — everything between a stored MASTER row and its rendered
 * instances.
 *
 * **Read side** ({@link expandedOccurrences}): a series is a single master row; its occurrences are
 * expanded on demand into synthetic, never-persisted `Entry` objects — from the master's raw .ics when
 * the integration stores one (the .ics carries the authoritative anchor and EXDATEs), else from the
 * recurrence columns plus the `exdates` column. This needs ical.js's rule iterator, which is why it
 * lives here in the backend and not on the (frontend-bundled) `Recurrence` value object.
 *
 * **Write side** ({@link editOccurrence} / {@link deleteOccurrence}): RFC 5545 occurrence-editing
 * scopes, built from the integration's primitives so they work for both CalDAV (.ics) and the local
 * Dev calendar:
 *  - **all**: shift the whole series by the edit's time delta and apply its other fields onto the master.
 *  - **following**: truncate the master to end before this occurrence, and start a new series at the edit.
 *  - **this**: detach — drop this occurrence from the series (EXDATE) and add a standalone entry with the edit.
 *
 * "this" is deliberately a *detach* (a standalone entry), not a linked RECURRENCE-ID override: RFC 4791 forbids
 * the same UID in two resources and mitra stores one .ics per row, so a true override would need same-resource
 * multi-VEVENT sync. Detaching is RFC-safe and uniform; the trade-off is the occurrence no longer follows later
 * series-wide edits. (Inbound overrides authored by other clients still render via their synced override rows.)
 */

/**
 * The occurrences of ONE recurring series — the iterable materialization of its rule. Constructed from
 * whatever the master actually stores ({@link Occurrences.of}): its raw .ics when the integration keeps
 * one (the .ics carries the authoritative anchor and EXDATEs), else the recurrence columns plus the
 * `exdates` column. A window then materializes the intersecting date-ranges via {@link within} — a
 * never-ending series stays finite because the window bounds it.
 */
export class Occurrences {
	private constructor(
		private readonly rule: ICAL.Recur,
		private readonly anchor: ICAL.Time,
		private readonly durationMs: number,
		private readonly exdates: ReadonlySet<number>,
	) { }

	/** The series' occurrences off a master entry, however it stores its rule; `undefined` when the
	 * entry isn't an expandable master (no rule, no start, or a malformed stored rule). */
	static of(master: Entry): Occurrences | undefined {
		if (master.data?.raw) {
			return Occurrences.fromICS(master.data.raw)
		}
		return !master.recurrence || !master.start ? undefined : Occurrences.fromRule(
			master.recurrence.toRRule(master.allDay),
			master.start as Date,
			master.end as Date | undefined,
			master.exdates ?? [],
		)
	}

	/**
	 * From a raw .ics: applies its EXDATEs and inherits the master's duration (DTEND/DUE − DTSTART).
	 * Works for VEVENT and VTODO (anchored on DTSTART, else DUE).
	 */
	static fromICS(raw: string): Occurrences | undefined {
		const component = new ICAL.Component(ICAL.parse(raw))
		const v = component.getFirstSubcomponent('vevent') ?? component.getFirstSubcomponent('vtodo')
		const rrule = v?.getFirstPropertyValue('rrule') as ICAL.Recur | null
		const anchor = (v?.getFirstPropertyValue('dtstart') ?? v?.getFirstPropertyValue('due')) as ICAL.Time | null
		if (!v || !rrule || !anchor) {
			return undefined
		}

		const endProp = (v.getFirstPropertyValue('dtend') ?? v.getFirstPropertyValue('due')) as { toJSDate(): Date } | null
		const durationMs = endProp ? endProp.toJSDate().getTime() - anchor.toJSDate().getTime() : 0

		const exdates = new Set<number>()
		for (const prop of v.getAllProperties('exdate')) {
			for (const value of prop.getValues()) {
				exdates.add((value as { toJSDate(): Date }).toJSDate().getTime())
			}
		}

		return new Occurrences(rrule, anchor, durationMs, exdates)
	}

	/**
	 * From DB columns (rrule string + start/end + excluded epoch-ms), with no raw .ics — integrations
	 * that don't persist one (e.g. the local `Dev` calendar) expand this way; `exdates` carries that
	 * calendar's exclusions (its EXDATE equivalent).
	 */
	static fromRule(rrule: string, start: Date, end: Date | undefined, exdates: ReadonlyArray<number> = []): Occurrences | undefined {
		let rule: ICAL.Recur
		let anchor: ICAL.Time
		try {
			rule = ICAL.Recur.fromString(rrule)
			anchor = ICAL.Time.fromJSDate(start, false)
		} catch {
			return undefined // malformed rule — render nothing rather than throw on a read
		}
		if (!rule.freq) {
			return undefined
		}
		return new Occurrences(rule, anchor, end ? end.getTime() - start.getTime() : 0, new Set(exdates))
	}

	/** The occurrence date-ranges intersecting [windowStart, windowEnd]. The rule's occurrences ascend
	 * from the anchor, so iteration stops once past the window; `maxIterations` is only a backstop for
	 * a pathological/non-advancing rule and is generous — a far-future window must still be reachable
	 * for a dense series (a daily one needs one iteration per day from the anchor to the window). */
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
			const startMs = time.toJSDate().getTime()
			if (startMs <= previousMs) {
				break // a non-advancing iterator (malformed rule) — don't spin
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
 * (fetched as a plain row) isn't duplicated by a default one.
 */
export async function expandedOccurrences(em: EntityManager, sourceIds: ReadonlyArray<string>, windowStart: Date, windowEnd: Date): Promise<Array<Entry>> {
	const masters = await em.find(Entry, { sourceId: { $in: [...sourceIds] }, recurrence: { freq: { $ne: null } } })
	const overrides = masters.length
		? await em.find(Entry, { recurrenceMasterId: { $in: masters.map(master => master.id!) } })
		: []
	const overridden = new Set(overrides.map(override => `${override.recurrenceMasterId}|${override.recurrenceId?.valueOf()}`))

	return masters.flatMap(master => {
		const ranges = Occurrences.of(master)?.within(windowStart, windowEnd) ?? []
		return ranges
			.filter(occurrence => !overridden.has(`${master.id}|${occurrence.start.valueOf()}`))
			.map(occurrence => new Entry({
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
				allDay: master.allDay,
				reminders: master.reminders,
				start: occurrence.start as DateTime,
				end: occurrence.end as DateTime,
				uid: master.uid,
				recurrence: master.recurrence,
				recurrenceMasterId: master.id,
				recurrenceId: occurrence.start as DateTime,
				seriesStart: master.start,
			}))
	})
}

// --- Write side: scoped edits -----------------------------------------------------------------------

// Backend entries are plain JS Dates at runtime (typed DateTime); shift by the edit's delta with Date math.
const shiftBy = (value: DateTime | undefined, deltaMs: number) =>
	value === undefined ? undefined : new Date(value.getTime() + deltaMs) as DateTime

/** Apply an occurrence edit (`edited`, carrying the new field values) to `master` at `recurrenceId`. */
export async function editOccurrence(em: EntityManager, integration: Integration, master: Entry, recurrenceId: Date, edited: Entry, scope: RecurrenceScope): Promise<Entry> {
	if (scope === 'all') {
		const editedStart = new Date(edited.start?.getTime() ?? recurrenceId.getTime())
		const delta = editedStart.getTime() - recurrenceId.getTime()
		const incoming = new Entry({
			sourceId: master.sourceId,
			type: master.type,
			heading: edited.heading,
			description: edited.description,
			location: edited.location,
			color: edited.color ?? null,
			status: edited.status,
			allDay: edited.allDay,
			reminders: edited.reminders,
			start: shiftBy(master.start, delta),
			end: shiftBy(master.end, delta),
			// The rule follows the shift (a weekly-Monday series moved a day later becomes weekly-Tuesday);
			// a rule left mismatching its shifted anchor would silently lose the anchor's own occurrence.
			recurrence: master.recurrence!.rebased(recurrenceId, editedStart),
			uid: master.uid,
		})
		await integration.updateEntry(em, master, incoming)
		return master
	}

	if (scope === 'following') {
		// Capture the rule before truncating the master (updateEntry mutates master.recurrence in place).
		const rule = master.recurrence!
		// Old half: same details, rule truncated to end before this occurrence.
		const truncated = new Entry({
			sourceId: master.sourceId,
			type: master.type,
			heading: master.heading,
			description: master.description,
			location: master.location,
			color: master.color ?? null,
			status: master.status,
			allDay: master.allDay,
			reminders: master.reminders,
			start: master.start,
			end: master.end,
			recurrence: rule.endingBefore(recurrenceId),
			uid: master.uid,
		})
		await integration.updateEntry(em, master, truncated)
		// New half: a fresh series (new UID) starting at the edit, continuing the original cadence — with
		// the rule rebased onto the edit's day, so the new anchor (possibly dragged to another weekday)
		// still matches it and renders as the continuation's first occurrence.
		const continuation = new Entry({
			id: crypto.randomUUID(),
			sourceId: master.sourceId,
			type: master.type,
			heading: edited.heading,
			description: edited.description,
			location: edited.location,
			color: edited.color ?? null,
			status: edited.status,
			allDay: edited.allDay,
			reminders: edited.reminders,
			start: edited.start,
			end: edited.end,
			recurrence: rule.asContinuation().rebased(recurrenceId, new Date(edited.start?.getTime() ?? recurrenceId.getTime())),
		})
		return integration.createEntry(em, continuation)
	}

	// 'this' — detach this occurrence into a standalone entry.
	await integration.excludeOccurrence(em, master, recurrenceId)
	const standalone = new Entry({
		id: crypto.randomUUID(),
		sourceId: master.sourceId,
		type: master.type,
		heading: edited.heading,
		description: edited.description,
		location: edited.location,
		color: edited.color ?? null,
		status: edited.status,
		allDay: edited.allDay,
		reminders: edited.reminders,
		start: edited.start,
		end: edited.end,
	})
	return integration.createEntry(em, standalone)
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
			allDay: master.allDay,
			reminders: master.reminders,
			start: master.start,
			end: master.end,
			recurrence: master.recurrence!.endingBefore(recurrenceId),
			uid: master.uid,
		})
		await integration.updateEntry(em, master, truncated)
		return
	}

	// 'this'
	await integration.excludeOccurrence(em, master, recurrenceId)
}
