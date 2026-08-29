import { DateTime } from '@3mo/date-time'
import { converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, enum as enumType, unique, manyToOne, embedded } from '../../infrastructure/model/orm.js'
import { EntryType, type EntryTypeValue } from './EntryType.js'
import { Source } from '../sources/Source.js'
import { Recurrence } from '../recurrence/Recurrence.js'
import { Participants, type ParticipantRole, type Participant } from '../participants/Participant.js'
import { type Relation, type RelationInit } from '../relations/Relation.js'
import { type RelationType } from '../relations/RelationType.js'
import { RelationEdge } from '../relations/RelationEdge.js'
import { EntryRelations } from '../relations/EntryRelations.js'
import { Checklist } from './Checklist.js'

export enum TaskStatus {
	ToDo = 'todo',
	Doing = 'doing',
	Done = 'done',
	Cancelled = 'cancelled',
}

/** Progress tally for a specific step category (subtasks or checklist items). */
export interface EntryTally {
	readonly done: number
	readonly total: number
}

/**
 * Task progress rollup derived from subtasks and description checklist items.
 * Total excludes cancelled subtasks; children and descendants count direct and full subtask trees.
 */
export interface EntryRollup {
	readonly done: number
	readonly total: number
	readonly progress: number
	readonly subtasks: EntryTally
	readonly checklist: EntryTally
	readonly children: number
	readonly descendants: number
}

/**
 * Whether an event's time counts as busy when someone asks whether you are available — RFC 5545's
 * TRANSP (§3.8.2.7), where OPAQUE (busy) is the default and TRANSPARENT (free) is the "I'm blocking
 * this out, but don't let it stop anyone booking me" case. EVENT-ONLY, exactly as {@link TaskStatus}
 * is task-only: a VTODO has no TRANSP, and free-busy generation considers events alone. Distinct from
 * {@link Visibility}, which is about who may READ the entry, not about what it does to your calendar.
 */
export enum Transparency {
	Busy = 'busy',
	Free = 'free',
}

/**
 * Who may see the entry's details on a shared calendar — RFC 5545's CLASS (§3.8.1.3). Unlike
 * {@link Transparency} this is NOT event-only: CLASS is equally valid on a VTODO, so it survives a
 * type flip.
 *
 * `null` is a real, user-pickable value ("Default visibility"): the RFC leaves an absent CLASS to
 * default to PUBLIC, and the calendar's own sharing settings decide in practice — which is what
 * Google's `visibility: default` and Notion Calendar's "Default visibility" both mean. So absence is
 * "let the calendar decide", NOT "public", and it is spelled `null` (like `color`) so it survives a
 * JSON round-trip, where an undefined key would read as "leave alone".
 */
export enum Visibility {
	Public = 'public',
	Private = 'private',
	Confidential = 'confidential',
}

export interface EntryData {
	raw?: string
	etag?: string
	/** The entry's counterpart at the provider as a user-facing link (e.g. a Notion page URL). */
	url?: string
	/** When mitra last WROTE this entry to its provider, in local epoch-ms (our own clock, never the
	 * provider's). Lets a sync spare a just-written row from deletion while the remote index catches
	 * up, without differencing two independent clocks. Set by the Notion write paths; see Notion.ts. */
	localWriteAt?: number
}

/** The reserved `Entry.timeZone` value for RFC 5545 FLOATING times ("09:00 wherever the observer
 * is") — deliberately not an IANA id, so every consumer that treats the field as a zone must handle
 * it explicitly. Never handed to Intl/Temporal: the wall clock of a floating entry is encoded
 * as-if-UTC in its instants, so 'UTC' is the zone to read/write those fields in. */
export const FLOATING_TIME_ZONE = 'floating'

/** Minimum duration in minutes an edit or resize may leave behind. */
export const MINIMUM_DURATION_MINUTES = 15

@model('Entry')
@entity()
// A resource (uri) may hold SEVERAL rows: the series master plus one per single-occurrence override
// (they share the .ics — see CalDAV.syncSourceEntries), so the row identity within a source is
// (uri, recurrenceId). SQLite treats NULLs as distinct, so masters (NULL recurrenceId) pass; their
// one-per-resource invariant is upheld by the sync logic, not the index.
@unique({ properties: ['sourceId', 'uri', 'recurrenceId'] })
export class Entry {
	// No default: the backend assigns the id on create. A locally-created entry (a drag draft) has no id
	// until then — `persisted` (below) is the single, intrinsic source of "is this still a draft". The
	// explicit `type` is required because, without a default value, MikroORM can't infer the column type.
	@primaryKey({ type: 'string' }) id?: string
	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'cascade' }) sourceId!: string
	@property({ type: 'string', nullable: true }) uri?: string

	/**
	 * Setting the type is the CONVERSION, not a plain field write: a status only makes sense on a task,
	 * so becoming an event drops it; becoming a task leaves it unset, which *is* "to do". That's why the
	 * editor's draft switch and {@link migrateTo} both just assign here.
	 *
	 * It also accepts the wire form (see {@link EntryType.parse}), so assigning a raw `"task"` lands as
	 * the instance. An unmodelled type throws rather than becoming an event.
	 *
	 * Crossing the API is NOT that assignment though: {@link EntryType.converter} maps this member onto
	 * the key `type` in both directions, so a response reproduces exactly what the server holds instead
	 * of re-running the conversion rule above on the way in.
	 */
	@property({ type: EntryType.Mapper, fieldName: 'type' })
	@converter({ type: EntryType.converter })
	private _type!: EntryType
	get type(): EntryType { return this._type }
	set type(value: EntryType | EntryTypeValue) {
		this._type = EntryType.parse(value)
		// Each kind sheds what only the other kind can hold: a status exists only on a task, a
		// free/busy contribution only on an event (RFC 5545 gives VTODO no TRANSP). `visibility` is
		// deliberately absent from both arms — CLASS is valid on either component, so it travels along.
		if (this._type.isTask) {
			this.transparency = null
		} else {
			this.status = undefined
			this.percentComplete = null
		}
	}

	@property({ type: 'string' }) heading = ''
	@property({ type: 'string' }) description = ''
	// A plain string, per RFC 5545: LOCATION is a TEXT property. Free text is always valid; the
	// editor's autocomplete merely helps produce a nicely formatted one.
	@property({ type: 'string' }) location = ''
	@property({ type: 'string', nullable: true }) color: string | null = null

	@property({ type: 'datetime', nullable: true }) start?: DateTime
	@property({ type: 'datetime', nullable: true }) end?: DateTime

	@enumType({ items: () => TaskStatus, nullable: true }) status?: TaskStatus

	/**
	 * Task PERCENT-COMPLETE (RFC 5545 §3.8.1.8), 0-100.
	 * `null` represents absence ("no percentage stated") to match DB nullability and avoid dirty diffs.
	 */
	@property({ type: 'number', nullable: true }) percentComplete: number | null = null

	/** Authored progress fraction (0-1) derived from percentComplete. Parent subtask rollups belong to {@link RelationGraph}. */
	get progress(): number | undefined {
		return this.percentComplete === null || this.percentComplete === undefined ? undefined : this.percentComplete / 100
	}

	/** Parsed description checklist items. */
	get checklist(): Checklist {
		return Checklist.of(this.description)
	}

	get done() { return this.status === TaskStatus.Done }
	set done(value) { this.status = value ? TaskStatus.Done : TaskStatus.ToDo }

	/** Whether the task outcome is decided (Done or Cancelled). An event is never closed. */
	get closed() { return this.status === TaskStatus.Done || this.status === TaskStatus.Cancelled }

	/** The event's free/busy contribution ({@link Transparency}) — cleared by the `type` setter when the
	 * entry becomes a task, the mirror of `status`. `null` means the RFC's OPAQUE default (busy), which
	 * is why nothing has to express "unset" from the client: the editor offers Busy and Free, and
	 * picking Busy on an entry that carries no TRANSP is simply no change at all.
	 *
	 * Empty is `null` rather than `undefined` (unlike `status`, and like `color`/`reminders`) because
	 * the two must not both occur: MikroORM hydrates the empty column as `null`, so a setter that wrote
	 * `undefined` would make a freshly synced row compare unequal to its own stored self and every
	 * `editEquals` consumer would see a phantom edit. */
	@enumType({ items: () => Transparency, nullable: true }) transparency: Transparency | null = null

	/** The access classification ({@link Visibility}) — `null` is the real value "let the calendar
	 * decide", not a missing one, so the column and the wire both carry it. Kept across a type flip:
	 * CLASS is as valid on a task as on an event. */
	@enumType({ items: () => Visibility, nullable: true }) visibility: Visibility | null = null

	@property({ type: 'boolean' }) allDay = false

	// The IANA zone the entry's times were AUTHORED in (stamped with the browser's zone at creation).
	// start/end stay absolute instants — this is not display metadata but recurrence semantics: a series
	// repeats at a WALL-CLOCK time in this zone ("every Monday 09:00 Berlin"), so expansion must know
	// which zone's 09:00 survives a DST flip (see features/recurrence/server/occurrences.ts).
	// Nullable because absence is a real domain state, not a hydration artifact: synced entries whose
	// DTSTART is UTC (no TZID) declared no authoring zone, rows predating this field never had one, and
	// the server must not invent one (its own zone is arbitrary — a UTC container). Only the CHOICE of
	// empty value (`null`, not undefined) follows the hydration convention, like `recurrence`.
	// The reserved value FLOATING_TIME_ZONE mirrors RFC 5545's third time form — a bare local time with
	// neither TZID nor `Z`, meaning "this wall clock wherever the observer is" ("take pill at 09:00").
	// Mitra doesn't author or fully render floating times yet, but it must never corrupt one another
	// client wrote: such entries keep the marker, encode their wall clock as-if-UTC in start/end, and
	// round-trip back to a bare local DTSTART (see CalDAV.ts). Rendering them per-viewer is future work.
	@property({ type: 'string', nullable: true }) timeZone?: string | null

	@property({ type: 'json', nullable: true }) data?: EntryData

	// Reminders, as MINUTES BEFORE START (0 = at start) — the flat value of RFC 5545's VALARM
	// subcomponents with a relative TRIGGER (-PT30M ↔ 30). Multiple allowed,
	// kept ascending and deduplicated by the editor. "None" is `null` on both sides of the wire (like
	// `recurrence`: MikroORM hydrates the empty column as null, and editEquals must see one value).
	@property({ type: 'json', nullable: true }) reminders?: Array<number> | null

	// --- Participants (RFC 5545 ATTENDEE / ORGANIZER) ---------------------------------------------------
	// The invitee list — one JSON column of `Participant` value records, like `reminders`, with the same
	// tri-state wire convention (array sets, `null` clears, absent keeps) and the same replace-don't-
	// mutate rule (clones share the array). The organizer is IN the list (`organizer: true`); `self`
	// marks the account's own address, stamped at sync/seed time. The mutations below are the entry's
	// own behavior — the editor wires straight to them, keeping all the list rules here (like the
	// timing methods) — and each assigns a NEW normalized list, never edits the held one.
	@property({ type: 'json', nullable: true }) participants?: Array<Participant> | null

	/** The list as its domain collection ({@link Participants}) — hydrated/wire arrays are plain, so
	 * behavior re-enters the domain here (normalization is idempotent, the lists are small). */
	get participantList(): Participants | null {
		return Participants.normalize(this.participants)
	}

	get organizer(): Participant | undefined {
		return this.participants?.find(participant => participant.organizer)
	}

	get hasParticipants() {
		return !!this.participants?.length
	}

	/** Whether the account may modify the participant list — iTIP (RFC 5546) reserves that for the
	 * ORGANIZER; the rule itself lives on the collection ({@link Participants.manageable}). */
	get canManageParticipants() {
		return this.participantList?.manageable ?? true
	}

	/** Invite `emails` — the list rules (dedupe, pending-required defaults, enlisting the account as
	 * organizer on the first invite) live on the collection ({@link Participants.inviting}).
	 * @returns whether anything was actually added. */
	invite(emails: ReadonlyArray<string>, ownAddress?: string): boolean {
		const invited = (this.participantList ?? new Participants()).inviting(emails, ownAddress)
		if (!invited) {
			return false
		}
		this.participants = invited
		return true
	}

	/** Set every invitee's attendance to `role` ({@link Participants.marked} — organizer untouched). */
	markAllParticipants(role: ParticipantRole) {
		this.participants = this.participantList?.marked(role) ?? null
	}

	/** Set ONE invitee's attendance to `role` ({@link Participants.withRole}).
	 * @returns whether anything actually changed. */
	setParticipantRole(email: string, role: ParticipantRole): boolean {
		const marked = this.participantList?.withRole(email, role)
		if (!marked) {
			return false
		}
		this.participants = marked
		return true
	}

	/** Uninvite ONE participant ({@link Participants.without} — which clears the list once the last
	 * invitee goes, and refuses the organizer).
	 * @returns whether anything actually changed. */
	removeParticipant(email: string): boolean {
		const list = this.participantList
		if (!list?.invitee(email)) {
			return false
		}
		this.participants = list.without(email)
		return true
	}

	/** Remove every participant — back to a plain private entry (the organizer included; without
	 * invitees there is nothing to organize). */
	clearParticipants() {
		this.participants = null
	}

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

	// --- Relationships ---------------------------------------------------------------------------------
	// The entry's OUTGOING relationships. Stored in EntryRelation table and materialized onto this field.
	// Tri-state: array sets, null clears, undefined keeps. Always replaced, never mutated in place.
	relations?: Array<Relation> | null

	/** Collection wrapper providing grouping, filtering, and edge helpers for this entry's relations. */
	get relationList() {
		return EntryRelations.of(this.uid, this.relations)
	}

	/** Adds an outgoing relationship (normalized, deduplicated). Replaces array to keep snapshots immutable. */
	relateTo(type: RelationType | string, targetUid: string) {
		this.relations = this.relationList.adding(type, targetUid).value
	}

	/** Removes an outgoing relationship by value; an emptied list collapses to null. */
	unrelate(relation: Relation) {
		this.relations = this.relationList.without(relation).value
	}

	/** Evaluates whether an outgoing dependency is violated relative to predecessor. */
	violates(relation: Relation | RelationInit, predecessor: Entry) {
		return RelationEdge.of(this.uid ?? '', relation)?.violatedBy(predecessor, this) ?? false
	}

	/** The boundary instant for dependency comparisons. All-day ends are stored exclusive. */
	boundaryOf(which: 'start' | 'end') {
		return which === 'start' ? this.start : this.end ?? this.start
	}

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

	/** Whether the entry can participate in relationships (persisted with a uid). */
	get relatable() {
		return this.persisted && !!this.uid
	}

	/**
	 * Whether the entry sits anywhere on the calendar. Undated rows are real — a Notion page with an
	 * empty date property, a VTODO with neither DTSTART nor DUE — and no window of days can contain
	 * one, so the grid cannot show them at all; the unscheduled section is the complement that does.
	 *
	 * Only the START counts: a bare due date already belongs to a day.
	 */
	get scheduled() {
		return !!this.start
	}

	/**
	 * Whether the entry may LOSE its dates again. A VTODO's date properties are both optional and
	 * Notion's is nullable, but DTSTART is REQUIRED of a VEVENT (RFC 5545 §3.6.1) — an undated event
	 * has no iCalendar form. The unscheduled section still RENDERS whatever undated rows a provider
	 * hands us: an entry no surface shows is one the user cannot fix.
	 */
	get unschedulable() {
		return this.type.isTask
	}

	/** True for a rendered occurrence (an expanded instance or a synced override) of a recurring series.
	 * Such entries edit/delete the whole series (via the master) and aren't independently movable in v1. */
	get isRecurring() {
		return !!this.recurrenceMasterId
	}

	/** True for the occurrence the series starts on — the one where "this and following" would reach
	 * the whole series and is therefore not worth offering. Both instants come from the expansion
	 * (see occurrences.ts), so a synced override, which carries no anchor, answers false. */
	get isSeriesStart() {
		return !!this.recurrenceId && !!this.seriesStart && this.recurrenceId.equals(this.seriesStart)
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
		const editable = ['sourceId', 'type', 'heading', 'description', 'location', 'color', 'start', 'end', 'allDay', 'timeZone', 'status', 'percentComplete', 'transparency', 'visibility', 'recurrence', 'reminders', 'participants'] as const
		// Relations are deliberately absent: they have their own write path (a relations-only PUT to
		// the series master — see RelationsField) and must never mark an entry dirty here.
		return editable.every(key => Object[equals](this[key], other[key]))
	}

	/** A value snapshot of this entry. Shallow — DateTimes are immutable and `data` is never mutated on
	 * the client, so sharing them is safe. */
	clone() {
		return new Entry({ ...this })
	}

	/** A standalone copy carrying only the user-editable content — no identity (`id`, `uri`, `uid`),
	 * no sync bookkeeping (`data` — its raw .ics could smuggle the source's RRULE back in), and no
	 * series membership: duplicating always yields a SINGLE entry, so a master sheds its rule and an
	 * occurrence sheds its link — the copy is based on that very occurrence, not the series. */
	duplicate() {
		return new Entry({
			sourceId: this.sourceId,
			type: this.type,
			heading: this.heading,
			description: this.description,
			location: this.location,
			color: this.color,
			start: this.start,
			end: this.end,
			allDay: this.allDay,
			timeZone: this.timeZone,
			status: this.status,
			percentComplete: this.percentComplete,
			transparency: this.transparency,
			visibility: this.visibility,
			reminders: this.reminders ? [...this.reminders] : this.reminders,
			// Copies inherit owned relations; derived incoming links belong to other entries and are omitted.
			relations: this.relationList.writes,
		})
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
			percentComplete: values.percentComplete,
			transparency: values.transparency,
			visibility: values.visibility,
			allDay: values.allDay,
			timeZone: values.timeZone,
			reminders: values.reminders,
			participants: values.participants,
			relations: values.relations,
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

	/** Move to a new start: a timed entry keeps its duration; an all-day entry shifts by whole days. */
	moveStart(start: DateTime) {
		if (this.allDay) {
			const day = start.dayStart
			const deltaDays = Math.round((day.valueOf() - this.start!.dayStart.valueOf()) / 86_400_000)
			this.end = this.effectiveEnd.add({ days: deltaDays })
			this.start = day
		} else {
			const duration = Math.max(this.effectiveEnd.valueOf() - this.start!.valueOf(), MINIMUM_DURATION_MINUTES * 60_000)
			this.start = start
			this.end = start.add({ milliseconds: duration })
		}
	}

	/** Schedules unscheduled entry with default or configured duration. */
	scheduleAt(start: DateTime, allDay: boolean, durationMinutes: number) {
		this.allDay = allDay
		this.start = allDay ? start.dayStart : start
		this.end = allDay ? start.dayStart.add({ days: 1 }) : this.start.add({ minutes: durationMinutes })
	}

	/** The inverse of {@link scheduleAt}. Only a task can hold this state (see {@link unschedulable}). */
	unschedule() {
		this.start = undefined
		this.end = undefined
	}

	/** Resize the end, keeping the start. */
	setEnd(end: DateTime) {
		if (this.allDay) {
			const startDay = this.start!.dayStart
			const lastDay = end.dayStart.valueOf() < startDay.valueOf() ? startDay : end.dayStart
			this.end = lastDay.add({ days: 1 })
		} else {
			const start = this.start!
			this.end = end.valueOf() <= start.valueOf() ? start.add({ minutes: MINIMUM_DURATION_MINUTES }) : end
		}
	}

	/** Move to another source. Converts entry type if target source does not support current type. */
	migrateTo(source: Source) {
		this.sourceId = source.id
		if (!source.supportsEntryType(this.type)) {
			this.type = source.defaultEntryType
		}
	}

	/** Adopt another entry's start, end, and all-day state. */
	adoptSpan(other: Entry) {
		this.start = other.start
		this.end = other.end
		this.allDay = other.allDay
	}

	/** Re-zones entry while keeping wall-clock time. */
	setTimeZone(zone: string) {
		if (!this.allDay) {
			const from = this.timeZone === FLOATING_TIME_ZONE ? 'UTC'
				: this.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
			const rezoned = (value: DateTime | undefined) => value === undefined ? undefined : new DateTime(
				Temporal.Instant.fromEpochMilliseconds(value.valueOf())
					.toZonedDateTimeISO(from)
					.toPlainDateTime()
					.toZonedDateTime(zone, { disambiguation: 'compatible' })
					.epochMilliseconds
			)
			this.start = rezoned(this.start)
			this.end = rezoned(this.end)
		}
		this.timeZone = zone
	}

	/** Sets all-day state, snapping to day bounds when enabled or defaulting to 09:00 with duration when disabled. */
	setAllDay(allDay: boolean, durationMinutes: number) {
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
			this.end = at.add({ minutes: durationMinutes })
		}
		this.allDay = allDay
	}
}
