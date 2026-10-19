import { Entry } from '../entries/Entry.js'
import { ValidationError } from '../../infrastructure/validation/ValidationError.js'
import { TimeZone } from '../time/TimeZone.js'
import { EntryOccurrence } from './EntryOccurrence.js'
import { RecurrenceSet, type RecurrenceSpan } from './RecurrenceSet.js'

/**
 * The dates an entry takes place on, yielded lazily in order: a one-off entry's one, a recurring entry's as its rule
 * gives them, endless for a rule without an end. Pure, so the server and the browser expand alike.
 */
export class EntryOccurrences {
	/** Recurring entries' occurrences in `window`. */
	static inWindow(entries: ReadonlyArray<Entry>, window: DateTimeRange): Array<EntryOccurrence> {
		return entries.flatMap(entry => !entry.occurrences.recurring ? [] : entry.occurrences.within(window))
	}

	/** Cached on the entry by what it reads, so asking again costs nothing until the rule or the dates change. */
	static of(entry: Entry) {
		const cached = EntryOccurrences.cache.get(entry)
		if (cached?.reads(entry)) {
			return cached
		}
		const occurrences = new EntryOccurrences(entry)
		EntryOccurrences.cache.set(entry, occurrences)
		return occurrences
	}

	private static readonly cache = new WeakMap<Entry, EntryOccurrences>()

	private readonly inputs: ReadonlyArray<unknown>
	private readonly set: RecurrenceSet | undefined
	private readonly interned = new Map<number, EntryOccurrence>()
	private oneOff?: EntryOccurrence

	private constructor(readonly entry: Entry) {
		this.inputs = EntryOccurrences.inputsOf(entry)
		this.set = this.setOf(entry)
	}

	private static inputsOf(entry: Entry) {
		return [entry.start, entry.end, entry.due, entry.allDay, entry.timeZone, entry.recurrence, entry.exdates, entry.recurringEntryId, entry.recurrenceId]
	}

	private reads(entry: Entry) {
		return EntryOccurrences.inputsOf(entry).every((input, index) => input === this.inputs[index])
	}

	/**
	 * The zone the entry repeats in, never the runtime's. All-day dates are midnights in `Entry.dayZone` (UTC but in the
	 * browser), and an entry without a zone (a UTC DTSTART recurs at fixed instants, RFC 5545 §3.8.5.3), a floating one or
	 * one in a zone no longer known iterates in UTC.
	 */
	get zone(): TimeZone {
		return this.entry.allDay ? Entry.dayZone() ?? TimeZone.UTC
			: !this.entry.timeZone ? TimeZone.UTC
				: TimeZone.parse(this.entry.timeZone.clock) ?? TimeZone.UTC
	}

	/** Whether a rule yields them, rather than the entry's own dates. */
	get recurring() {
		return !!this.set
	}

	/** What the rule iterates: the start, or the due of an unscheduled task. */
	private get anchor() {
		return this.entry.start ?? this.entry.due
	}

	private setOf(entry: Entry) {
		const anchor = this.anchor
		// An override shows its entry's rule but takes place once.
		if (!anchor || !entry.recurrence || entry.recurringEntryId) {
			return undefined
		}
		return RecurrenceSet.fromRule(entry.recurrence.toRRule(entry.allDay), anchor, entry.start ? entry.end : undefined, entry.exdates ?? [], this.zone.id)
	}

	/** The occurrences starting at or after `after`. */
	private *from(after: Date): Generator<EntryOccurrence, void, undefined> {
		if (!this.set) {
			if (this.anchor && this.anchor >= after) {
				yield this.single
			}
			return
		}
		for (const span of this.set.from(after)) {
			yield this.occurrenceOf(span)
		}
	}

	/**
	 * The occurrences overlapping a closed `window`, each override in place of the date it takes over. The rule's dates
	 * for the last window are kept, as views ask for it on every frame.
	 */
	within(window: DateTimeRange, overrides = this.entry.overrides ?? []): ReadonlyArray<EntryOccurrence> {
		const start = window.start!
		const end = window.end!
		const overlaps = (occurrence: EntryOccurrence) => {
			const first = occurrence.start ?? occurrence.due
			return !!first && first <= end && (occurrence.end ?? first) >= start
		}
		if (!this.set) {
			return overlaps(this.single) ? [this.single] : []
		}
		if (!this.lastWindow?.window.equals(window)) {
			this.lastWindow = { window, occurrences: this.set.within(start, end).map(span => this.occurrenceOf(span)) }
		}
		if (!overrides.length) {
			return this.lastWindow.occurrences
		}
		const taken = new Set(overrides.map(override => override.recurrenceId?.getTime()))
		return [
			...this.lastWindow.occurrences.filter(occurrence => !taken.has(occurrence.recurrenceId!.getTime())),
			...overrides.map(override => this.overriddenBy(override)).filter(overlaps),
		]
	}

	private lastWindow?: { readonly window: DateTimeRange, readonly occurrences: ReadonlyArray<EntryOccurrence> }

	/** The occurrence `override` stands in for, at its own dates. */
	overriddenBy(override: Entry) {
		return new EntryOccurrence(override, override.start, override.end, override.due, override.recurrenceId, this.entry)
	}

	/** The occurrence in progress or next to come, else the last, passing over the dates an override takes. */
	private nearest(instant: Date) {
		const taken = new Set(this.entry.overrides?.map(override => override.recurrenceId?.getTime()))
		const span = this.set?.nearest(instant, startMs => taken.has(startMs))
		return !this.set ? this.single : span && this.occurrenceOf(span)
	}

	/** The occurrence standing for the entry at `now`: its own, else the one in progress or next, an unscheduled task's current one in `zone`. */
	standing(zone: string, now = new Date()) {
		return !this.set ? this.single : this.entry.start ? this.nearest(now) : this.current(zone, now)
	}

	/** An unscheduled task's occurrence the viewer has to do next: the first whose due day has not gone by in `zone`. */
	current(zone: string, now = new Date()) {
		const here = TimeZone.of(zone)
		const today = (this.entry.allDay ? this.zone : here).midnightOf(here.dayOf(now))
		return this.from(today).next().value
	}

	/** Whether the rule still yields `date`, not excluded. */
	yields(date: Date) {
		return this.from(date).next().value?.recurrenceId?.getTime() === date.getTime()
	}

	/** The occurrence the rule starts from. */
	get anchored() {
		const anchor = this.anchor
		return !this.set || !anchor ? undefined : this.at(anchor)
	}

	/** The occurrence a request names by its original start, refused where the entry does not repeat or never takes place then. */
	existing(recurrenceId: Date) {
		if (!this.recurring) {
			throw new ValidationError('This entry does not repeat', ['occurrence'])
		}
		const overridden = this.entry.overrides?.some(override => override.recurrenceId?.getTime() === recurrenceId.getTime())
		if (!overridden && !this.yields(recurrenceId)) {
			throw new ValidationError(`The entry takes no place at ${recurrenceId.toISOString()}`, ['occurrence'])
		}
		return this.at(recurrenceId)
	}

	/** The occurrence at `recurrenceId`, lasting as long as the entry does. */
	at(recurrenceId: Date) {
		const span = this.entry.start && this.entry.end ? this.entry.end.getTime() - this.entry.start.getTime() : 0
		return this.occurrenceOf({ start: recurrenceId, end: new Date(recurrenceId.getTime() + span) })
	}

	/** Blind to exclusions, as RFC 5545 counts COUNT before EXDATEs prune the set. */
	generatedBefore(instant: Date) {
		return this.set?.generatedBefore(instant) ?? 0
	}

	/** The instants of the excluded occurrences. */
	get excluded(): Array<number> {
		return this.entry.exdates ?? []
	}

	/** The entry's own dates as one occurrence. */
	get single() {
		const { entry } = this
		return this.oneOff ??= new EntryOccurrence(entry, entry.start, entry.end, entry.due, entry.recurrenceId)
	}

	/** The due keeps its exact offset from the start, as the end does (RFC 5545 §3.8.5.3). */
	private occurrenceOf(span: RecurrenceSpan) {
		const startMs = span.start.getTime()
		const interned = this.interned.get(startMs)
		if (interned) {
			return interned
		}
		const { entry } = this
		const scheduled = !!entry.start
		const dueOffset = entry.due && entry.start ? entry.due.getTime() - entry.start.getTime() : 0
		const occurrence = new EntryOccurrence(
			entry,
			scheduled ? new DateTime(startMs) : undefined,
			scheduled && entry.end ? new DateTime(span.end.getTime()) : undefined,
			entry.due ? new DateTime(startMs + dueOffset) : undefined,
			new DateTime(startMs),
			entry,
		)
		this.interned.set(startMs, occurrence)
		return occurrence
	}
}
