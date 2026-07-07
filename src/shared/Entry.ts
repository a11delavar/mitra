import { type DateTime } from '@3mo/date-time'
import { equals } from '@a11d/equals'
import { model } from './model.js'
import { entity, primaryKey, property, enum as enumType, unique, manyToOne, embedded } from './orm.js'
import { Source, SourceType } from './Source.js'
import { Recurrence } from './Recurrence.js'

export enum EntryType {
	Event = 'event',
	Task = 'task',
}

export enum TaskStatus {
	ToDo = 'todo',
	Doing = 'doing',
	Done = 'done',
	Cancelled = 'cancelled',
}

export interface EntryData {
	raw?: string
	etag?: string
}

/** The granularity timed edits and gestures snap to, and the minimum duration an edit leaves behind.
 * A single knob today; a user setting later. */
export const SNAP_MINUTES = 15

/** A newly-created TIMED entry starts with a reminder this many minutes before — the convention other
 * calendars default to, so an event you jot down still nudges you without a manual step. All-day entries
 * get none: "30 min before" a midnight start fires at 23:30 the night before, which is nobody's intent.
 * A default, not a decree — it renders as a normal removable row in the editor. A single knob today; a
 * user setting later, like {@link SNAP_MINUTES}. */
export const DEFAULT_REMINDER_MINUTES = 30

@model('Entry')
@entity()
@unique({ properties: ['sourceId', 'uri'] })
export class Entry {
	// No default: the backend assigns the id on create. A locally-created entry (a drag draft) has no id
	// until then — `persisted` (below) is the single, intrinsic source of "is this still a draft". The
	// explicit `type` is required because, without a default value, MikroORM can't infer the column type.
	@primaryKey({ type: 'string' }) id?: string
	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'cascade' }) sourceId!: string
	@property({ type: 'string', nullable: true }) uri?: string

	@enumType(() => EntryType) type!: EntryType

	@property({ type: 'string' }) heading = ''
	@property({ type: 'string' }) description = ''
	// A plain string, per RFC 5545: LOCATION is a TEXT property. Free text is always valid; the
	// editor's autocomplete merely helps produce a nicely formatted one.
	@property({ type: 'string' }) location = ''
	@property({ type: 'string', nullable: true }) color: string | null = null

	@property({ type: 'datetime', nullable: true }) start?: DateTime
	@property({ type: 'datetime', nullable: true }) end?: DateTime

	@enumType({ items: () => TaskStatus, nullable: true }) status?: TaskStatus

	get done() { return this.status === TaskStatus.Done }
	set done(value) { this.status = value ? TaskStatus.Done : TaskStatus.ToDo }

	@property({ type: 'boolean' }) allDay = false

	// The IANA zone the entry's times were AUTHORED in (stamped with the browser's zone at creation).
	// start/end stay absolute instants — this is not display metadata but recurrence semantics: a series
	// repeats at a WALL-CLOCK time in this zone ("every Monday 09:00 Berlin"), so expansion must know
	// which zone's 09:00 survives a DST flip (see backend/occurrences.ts).
	// Nullable because absence is a real domain state, not a hydration artifact: synced entries whose
	// DTSTART is UTC/floating (no TZID) declared no authoring zone, rows predating this field never had
	// one, and the server must not invent one (its own zone is arbitrary — a UTC container). Only the
	// CHOICE of empty value (`null`, not undefined) follows the hydration convention, like `recurrence`.
	@property({ type: 'string', nullable: true }) timeZone?: string | null

	@property({ type: 'json', nullable: true }) data?: EntryData

	// Reminders, as MINUTES BEFORE START (0 = at start) — the flat value of RFC 5545's VALARM
	// subcomponents with a relative TRIGGER (-PT30M ↔ 30). Multiple allowed,
	// kept ascending and deduplicated by the editor. "None" is `null` on both sides of the wire (like
	// `recurrence`: MikroORM hydrates the empty column as null, and editEquals must see one value).
	@property({ type: 'json', nullable: true }) reminders?: Array<number> | null

	// --- Recurrence (RFC 5545) ------------------------------------------------------------------------
	// A recurring series is a single MASTER row carrying the `recurrence` rule (a value object → recurrence_*
	// columns); its occurrences are expanded on read, never stored. A single edited occurrence is its own
	// OVERRIDE row (it has a `recurrenceId` but no `recurrence` rule of its own), linked to its master by the
	// shared iCal UID. Expanded occurrences are synthetic (non-persisted) Entry objects that carry
	// `recurrenceMasterId` so edits route to the series. `exdates` holds excluded occurrence epoch-ms (the
	// non-.ics integrations' EXDATE; CalDAV keeps its EXDATEs inside data.raw). `recurrence` is tri-state on
	// the wire: an object sets the rule, `null` removes it deliberately, absent/undefined leaves it alone —
	// JSON drops undefined keys, so only an explicit null can express "remove" in a full-entry PUT.
	@property({ type: 'string', nullable: true }) uid?: string
	@embedded(() => Recurrence, { prefix: 'recurrence_', nullable: true }) recurrence?: Recurrence | null
	@property({ type: 'json', nullable: true }) exdates?: Array<number>
	@property({ type: 'string', nullable: true }) recurrenceMasterId?: string
	@property({ type: 'datetime', nullable: true }) recurrenceId?: DateTime
	/** The series anchor (the master's own start), carried on expanded occurrences so rule editing from
	 * ANY occurrence derives its suggestions from the date the rule actually iterates from — a rule that
	 * doesn't match its anchor silently loses the occurrences before its first match. Deliberately not a
	 * column: it's derived render-state on synthetic occurrences, never persisted. */
	seriesStart?: DateTime

	get duration() {
		if (!this.start || !this.end) {
			return undefined
		}

		const minutes = this.end.since(this.start).minutes

		return new Intl.DurationFormat(Localizer.languages.current, { style: 'narrow' }).format({
			days: Math.floor(minutes / 60 / 24),
			hours: Math.floor(minutes / 60),
			minutes: Math.floor(minutes % 60)
		})
	}

	constructor(init?: Partial<Entry>) {
		Object.assign(this, init)
	}

	/** Whether the backend has assigned this entry an id. A locally-created draft has none until it's
	 * saved, so `!persisted` *is* "this is a draft" — no separate flag or side store to keep in sync. */
	get persisted() {
		return this.id !== undefined
	}

	/** True for a rendered occurrence (an expanded instance or a synced override) of a recurring series.
	 * Such entries edit/delete the whole series (via the master) and aren't independently movable in v1. */
	get isRecurring() {
		return !!this.recurrenceMasterId
	}

	/** True when the entry belongs to a recurring series — either the master that carries the rule
	 * (`recurrence`) or one of its occurrences (`isRecurring`). Such entries aren't independently
	 * drag/resize-movable; their schedule is read-only in the editor (the rule itself stays editable). */
	get partOfSeries() {
		return !!this.recurrence || this.isRecurring
	}

	/** Whether another entry carries the same user-editable content — the surface an edit changes and a
	 * save round-trips. Identity and sync bookkeeping (`id`, `uri`, `data`) are deliberately excluded, so
	 * a local working copy compares equal to its server counterpart exactly when there's nothing left to
	 * persist. DateTimes compare by value via `Object[equals]`. */
	editEquals(other: Entry) {
		// `recurrence` counts as editable content (the Repeat field mutates it); `Object[equals]` compares
		// the value objects structurally. The series *link* fields (uid, recurrenceMasterId, recurrenceId,
		// exdates) are sync bookkeeping like `uri`/`data`, so they stay excluded.
		const editable = ['sourceId', 'type', 'heading', 'description', 'location', 'color', 'start', 'end', 'allDay', 'timeZone', 'status', 'recurrence', 'reminders'] as const
		return editable.every(key => Object[equals](this[key], other[key]))
	}

	/** A value snapshot of this entry. Shallow — DateTimes are immutable and `data` is never mutated on
	 * the client, so sharing them is safe. */
	clone() {
		return new Entry({ ...this })
	}

	/** Adopt another entry's values onto THIS instance — in place, so identity (and everything keyed on
	 * it: open editors, segment memos, view-transition names) survives a server refresh. Every field is
	 * assigned explicitly so values the other entry *lacks* (e.g. a status cleared on the server) are
	 * cleared here too, rather than lingering. */
	assign(values: Entry) {
		return Object.assign(this, {
			id: values.id,
			sourceId: values.sourceId,
			uri: values.uri,
			type: values.type,
			heading: values.heading,
			description: values.description,
			location: values.location,
			color: values.color,
			start: values.start,
			end: values.end,
			status: values.status,
			allDay: values.allDay,
			timeZone: values.timeZone,
			reminders: values.reminders,
			data: values.data,
			uid: values.uid,
			recurrence: values.recurrence,
			exdates: values.exdates,
			recurrenceMasterId: values.recurrenceMasterId,
			recurrenceId: values.recurrenceId,
			seriesStart: values.seriesStart,
		})
	}

	get multiDay() {
		if (!this.start || !this.end) {
			return false
		}
		// All-day spans store the end as the exclusive next midnight, so a single all-day day is
		// start=day, end=day+1 — compare against the inclusive last day, not the raw end.
		return this.inclusiveEnd.dayStart.valueOf() > this.start.dayStart.valueOf()
	}

	// --- Timing (frontend-only) -----------------------------------------------------------------------
	// These read/mutate the span with DateTime arithmetic, so — like `multiDay`/`duration` — they only run
	// on the frontend (where start/end are DateTimes). The backend keeps start/end as plain Dates and never
	// calls them. The entry editor wires its inputs straight to these, keeping all the span rules here.

	/** The exclusive end to measure/edit against; tolerates a malformed entry (no end, or an end not after
	 * the start — e.g. an all-day task synced without a DUE) by treating it as a single day. */
	get effectiveEnd(): DateTime {
		const start = this.start!
		if (this.end && this.end.valueOf() > start.valueOf()) {
			return this.end
		}
		return this.allDay ? start.dayStart.add({ days: 1 }) : start
	}

	/** The inclusive last day, for display — all-day ends are stored exclusive-next-midnight. */
	get inclusiveEnd(): DateTime {
		return this.allDay ? this.effectiveEnd.subtract({ days: 1 }) : this.effectiveEnd
	}

	/** Move to a new start: a timed entry keeps its duration; an all-day entry shifts its whole span by
	 * whole days, so it keeps its length. */
	moveStart(start: DateTime) {
		if (this.allDay) {
			const day = start.dayStart
			const deltaDays = Math.round((day.valueOf() - this.start!.dayStart.valueOf()) / 86_400_000)
			this.end = this.effectiveEnd.add({ days: deltaDays })
			this.start = day
		} else {
			const duration = Math.max(this.effectiveEnd.valueOf() - this.start!.valueOf(), SNAP_MINUTES * 60_000)
			this.start = start
			this.end = start.add({ milliseconds: duration })
		}
	}

	/** Resize the end, keeping the start. For all-day, `end` is the inclusive last day (clamped to at least
	 * the start day); for timed, an end at/under the start snaps to a one-snap-minute minimum. */
	setEnd(end: DateTime) {
		if (this.allDay) {
			const startDay = this.start!.dayStart
			const lastDay = end.dayStart.valueOf() < startDay.valueOf() ? startDay : end.dayStart
			this.end = lastDay.add({ days: 1 })
		} else {
			const start = this.start!
			this.end = end.valueOf() <= start.valueOf() ? start.add({ minutes: SNAP_MINUTES }) : end
		}
	}

	/** Move to another source. The entry's shape follows the target intrinsically: a task list holds
	 * tasks and a calendar holds events, and a status only makes sense on a task. The identity and
	 * link fields (`id`, `uri`, `data`) are deliberately untouched — a cross-source migration
	 * re-creates the entry over there, and the backend owns those. */
	migrateTo(source: Source) {
		this.sourceId = source.id
		this.type = source.type === SourceType.Task ? EntryType.Task : EntryType.Event
		if (this.type === EntryType.Event) {
			this.status = undefined
		}
	}

	/** Adopt another entry's span — the three fields that place it in time. What a gesture hands over
	 * on release: a drag may not just have shifted the span but flipped its all-day-ness (a move between
	 * the timed grid and the all-day lane), so the flag travels with the times. */
	adoptSpan(other: Entry) {
		this.start = other.start
		this.end = other.end
		this.allDay = other.allDay
	}

	/** Flip all-day: ON snaps to the day bounds it currently covers; OFF restores a default 09:00–10:00
	 * slot on the start day (an all-day entry has no clock time to restore). */
	setAllDay(allDay: boolean) {
		if (allDay === this.allDay || !this.start) {
			this.allDay = allDay
			return
		}
		if (allDay) {
			const firstDay = this.start.dayStart
			const lastDay = this.effectiveEnd.dayStart
			this.start = firstDay
			this.end = (lastDay.valueOf() > firstDay.valueOf() ? lastDay : firstDay).add({ days: 1 })
		} else {
			const at = this.start.dayStart.with({ hour: 9 })
			this.start = at
			this.end = at.add({ hours: 1 })
		}
		this.allDay = allDay
	}
}
