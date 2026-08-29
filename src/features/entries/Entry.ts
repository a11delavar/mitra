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

export interface EntryTally {
	readonly done: number
	readonly total: number
}

/**
 * Task progress rollup derived from subtasks and description checklist items.
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
 * RFC 5545 TRANSP availability contribution (Busy/Free) for events.
 */
export enum Transparency {
	Busy = 'busy',
	Free = 'free',
}

/**
 * RFC 5545 CLASS access classification.
 */
export enum Visibility {
	Public = 'public',
	Private = 'private',
	Confidential = 'confidential',
}

export interface EntryData {
	raw?: string
	etag?: string
	url?: string
	localWriteAt?: number
}

/** Reserved `Entry.timeZone` value for RFC 5545 floating times. */
export const FLOATING_TIME_ZONE = 'floating'

export const MINIMUM_DURATION_MINUTES = 15

@model('Entry')
@entity()
@unique({ properties: ['sourceId', 'uri', 'recurrenceId'] })
export class Entry {
	@primaryKey({ type: 'string' }) id?: string
	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'cascade' }) sourceId!: string
	@property({ type: 'string', nullable: true }) uri?: string

	@property({ type: EntryType.Mapper, fieldName: 'type' })
	@converter({ type: EntryType.converter })
	private _type!: EntryType
	get type(): EntryType { return this._type }
	set type(value: EntryType | EntryTypeValue) {
		this._type = EntryType.parse(value)
		if (this._type.isTask) {
			this.transparency = null
		} else {
			this.status = undefined
			this.percentComplete = null
		}
	}

	@property({ type: 'string' }) heading = ''
	@property({ type: 'string' }) description = ''
	@property({ type: 'string' }) location = ''
	@property({ type: 'string', nullable: true }) color: string | null = null

	@property({ type: 'datetime', nullable: true }) start?: DateTime
	@property({ type: 'datetime', nullable: true }) end?: DateTime

	@enumType({ items: () => TaskStatus, nullable: true }) status?: TaskStatus

	/** Task PERCENT-COMPLETE (RFC 5545 §3.8.1.8), 0-100. */
	@property({ type: 'number', nullable: true }) percentComplete: number | null = null

	get progress(): number | undefined {
		return this.percentComplete === null || this.percentComplete === undefined ? undefined : this.percentComplete / 100
	}

	get checklist(): Checklist {
		return Checklist.of(this.description)
	}

	get done() { return this.status === TaskStatus.Done }
	set done(value) { this.status = value ? TaskStatus.Done : TaskStatus.ToDo }

	/** Whether the task outcome is decided (Done or Cancelled). */
	get closed() { return this.status === TaskStatus.Done || this.status === TaskStatus.Cancelled }

	@enumType({ items: () => Transparency, nullable: true }) transparency: Transparency | null = null
	@enumType({ items: () => Visibility, nullable: true }) visibility: Visibility | null = null

	@property({ type: 'boolean' }) allDay = false
	@property({ type: 'string', nullable: true }) timeZone?: string | null
	@property({ type: 'json', nullable: true }) data?: EntryData
	@property({ type: 'json', nullable: true }) reminders?: Array<number> | null

	/** Date-time anchor that reminders count back from (`start`, falling back to `end` for due-only tasks). */
	get reminderAnchor(): DateTime | undefined {
		return this.start ?? (this.type?.isTask ? this.end : undefined)
	}

	get remindersAnchorToEnd() {
		return !this.start && !!this.reminderAnchor
	}

	@property({ type: 'json', nullable: true }) participants?: Array<Participant> | null

	get participantList(): Participants | null {
		return Participants.normalize(this.participants)
	}

	get organizer(): Participant | undefined {
		return this.participants?.find(participant => participant.organizer)
	}

	get hasParticipants() {
		return !!this.participants?.length
	}

	get canManageParticipants() {
		return this.participantList?.manageable ?? true
	}

	invite(emails: ReadonlyArray<string>, ownAddress?: string): boolean {
		const invited = (this.participantList ?? new Participants()).inviting(emails, ownAddress)
		if (!invited) {
			return false
		}
		this.participants = invited
		return true
	}

	markAllParticipants(role: ParticipantRole) {
		this.participants = this.participantList?.marked(role) ?? null
	}

	setParticipantRole(email: string, role: ParticipantRole): boolean {
		const marked = this.participantList?.withRole(email, role)
		if (!marked) {
			return false
		}
		this.participants = marked
		return true
	}

	removeParticipant(email: string): boolean {
		const list = this.participantList
		if (!list?.invitee(email)) {
			return false
		}
		this.participants = list.without(email)
		return true
	}

	clearParticipants() {
		this.participants = null
	}

	@property({ type: 'string', nullable: true }) uid?: string
	@embedded(() => Recurrence, { prefix: 'recurrence_', nullable: true }) recurrence?: Recurrence | null
	@property({ type: 'json', nullable: true }) exdates?: Array<number>
	@property({ type: 'string', nullable: true }) recurrenceMasterId?: string
	@property({ type: 'datetime', nullable: true }) recurrenceId?: DateTime
	seriesStart?: DateTime

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

	/** Whether another entry carries the same user-editable content. */
	editEquals(other: Entry) {
		const editable = ['sourceId', 'type', 'heading', 'description', 'location', 'color', 'start', 'end', 'allDay', 'timeZone', 'status', 'percentComplete', 'transparency', 'visibility', 'recurrence', 'reminders', 'participants'] as const
		return editable.every(key => Object[equals](this[key], other[key]))
	}

	clone() {
		return new Entry({ ...this })
	}

	/** Creates a standalone copy with user-editable fields (excluding identity, sync data, and recurrence rules). */
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
			relations: this.relationList.writes,
		})
	}

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
		return this.inclusiveEnd.dayStart.valueOf() > this.start.dayStart.valueOf()
	}

	/** Exclusive end DateTime to measure or edit against. */
	get effectiveEnd(): DateTime {
		const start = this.start!
		if (this.end && this.end.valueOf() > start.valueOf()) {
			return this.end
		}
		return this.allDay ? start.dayStart.add({ days: 1 }) : start
	}

	/** Inclusive last day for display (all-day ends are stored exclusive-next-midnight). */
	get inclusiveEnd(): DateTime {
		return this.allDay ? this.effectiveEnd.subtract({ days: 1 }) : this.effectiveEnd
	}

	/** Moves start DateTime, preserving duration for timed entries or whole days for all-day entries. */
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

	unschedule() {
		this.start = undefined
		this.end = undefined
		this.reminders = null
	}

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

	/** Moves entry to another source, converting type if unsupported by target. */
	migrateTo(source: Source) {
		this.sourceId = source.id
		if (!source.supportsEntryType(this.type)) {
			this.type = source.defaultEntryType
		}
	}

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
