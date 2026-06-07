import { type DateTime } from '@3mo/date-time'
import { model } from './model.js'
import { entity, primaryKey, property, enum as enumType, unique, manyToOne } from './orm.js'
import { Source } from './Source.js'

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
	@property({ type: 'string', nullable: true }) color: string | null = null

	@property({ type: 'datetime', nullable: true }) start?: DateTime
	@property({ type: 'datetime', nullable: true }) end?: DateTime

	@enumType({ items: () => TaskStatus, nullable: true }) status?: TaskStatus

	get done() { return this.status === TaskStatus.Done }
	set done(value) { this.status = value ? TaskStatus.Done : TaskStatus.ToDo }

	@property({ type: 'boolean' }) allDay = false

	@property({ type: 'json', nullable: true }) data?: EntryData

	// --- Recurrence (RFC 5545) ------------------------------------------------------------------------
	// A recurring series is a single MASTER row carrying the RRULE; its occurrences are expanded on read,
	// never stored. A single edited occurrence arrives from CalDAV as its own override row (it has a
	// RECURRENCE-ID), linked back to its master by the shared iCal UID. Expanded occurrences are synthetic
	// (non-persisted) Entry objects that carry `recurrenceMasterId` so edits route to the series.
	@property({ type: 'string', nullable: true }) uid?: string
	@property({ type: 'string', nullable: true }) rrule?: string
	@property({ type: 'string', nullable: true }) recurrenceMasterId?: string
	@property({ type: 'datetime', nullable: true }) recurrenceId?: DateTime

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
