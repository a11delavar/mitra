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
import { EntryRank } from './EntryRank.js'
import { Checklist } from './Checklist.js'
import { type ReminderDefaults } from '../reminders/ReminderDefaults.js'
import { type Integration } from '../../integrations/Integration.js'
import { TimeZone } from '../time/TimeZone.js'

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

/** Task progress from subtasks and description checklist items alike. */
export interface EntryRollup {
	readonly done: number
	readonly total: number
	readonly progress: number
	readonly subtasks: EntryTally
	readonly checklist: EntryTally
	readonly children: number
	readonly descendants: number
}

/** RFC 5545 TRANSP. */
export enum Transparency {
	Busy = 'busy',
	Free = 'free',
}

/** RFC 5545 CLASS. */
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

/** The defaults an entry's reminders still follow, until the user sets their own. Kept off the entry so it is never persisted, cloned or sent. */
const reminderDefaults = new WeakMap<Entry, ReminderDefaults>()

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
			this.due = undefined
			this.estimate = null
		}
		if (this._type.isAvailability) {
			this.participants = null
			this.reminders = null
		}
		const defaults = reminderDefaults.get(this)
		if (defaults) {
			this.adoptDefaultReminders(defaults)
		}
	}

	@property({ type: 'string' }) heading = ''
	@property({ type: 'string' }) description = ''
	@property({ type: 'string' }) location = ''
	@property({ type: 'string', nullable: true }) color: string | null = null

	@property({ type: 'Date', nullable: true }) start?: DateTime
	@property({ type: 'Date', nullable: true }) end?: DateTime

	/** Apart from the schedule. All-day, it is the due day's canonical midnight. */
	@property({ type: 'Date', nullable: true }) due?: DateTime

	/** A task's length in minutes while it has no start. The end is the same fact once it does, so one of the two is always empty. */
	@property({ type: 'number', nullable: true }) estimate: number | null = null

	@enumType({ items: () => TaskStatus, nullable: true }) status?: TaskStatus

	/** Task PERCENT-COMPLETE (RFC 5545 §3.8.1.8), 0-100. */
	@property({ type: 'number', nullable: true }) percentComplete: number | null = null

	/** Position in the manual order, owned by Mitra and never written to the provider. Only
	 * `PUT /entries/ranks` changes it, so editEquals ignores it. */
	@converter(EntryRank.converter)
	@property({ type: EntryRank.Mapper, nullable: true }) rank: EntryRank | null = null

	get progress(): number | undefined {
		return this.percentComplete === null || this.percentComplete === undefined ? undefined : this.percentComplete / 100
	}

	get checklist(): Checklist {
		return Checklist.of(this.description)
	}

	get done() { return this.status === TaskStatus.Done }
	set done(value) { this.status = value ? TaskStatus.Done : TaskStatus.ToDo }

	get closed() { return this.status === TaskStatus.Done || this.status === TaskStatus.Cancelled }

	setStatus(status: TaskStatus, capabilities: Pick<Integration['capabilities'], 'percentComplete'>) {
		this.status = status
		if (status === TaskStatus.Done && capabilities.percentComplete) {
			this.percentComplete = 100
		}
	}

	@enumType({ items: () => Transparency, nullable: true }) transparency: Transparency | null = null
	@enumType({ items: () => Visibility, nullable: true }) visibility: Visibility | null = null

	/** TRANSP with its default filled in: busy for events (RFC 5545), free for availability. */
	get showAs(): Transparency {
		return this.transparency ?? (this.type?.isAvailability ? Transparency.Free : Transparency.Busy)
	}

	@property({ type: 'boolean' }) allDay = false
	@property({ type: 'string', nullable: true }) timeZone?: string | null

	/** Times on whatever clock the reader's is (RFC 5545 floating), stored as if in UTC: an alarm at 7:00 anywhere. */
	get floating() {
		return !this.allDay && this.timeZone === FLOATING_TIME_ZONE
	}

	/** The zone its times are written in: none for an all-day entry, whose days are everyone's, nor for a floating one, as `floating` names no zone. */
	get zone(): TimeZone | undefined {
		return this.allDay ? undefined : TimeZone.parse(this.timeZone)
	}

	@property({ type: 'json', nullable: true }) data?: EntryData
	@property({ type: 'json', nullable: true }) reminders?: Array<number> | null

	get reminderAnchor(): DateTime | undefined {
		return this.start ?? (this.type?.isTask ? this.due : undefined)
	}

	get remindersAnchorToEnd() {
		return !this.start && !!this.reminderAnchor
	}

	/** Floating times resolve in the observer's `zone`. */
	reminderAnchorInstant(zone?: string): number | undefined {
		const anchor = this.reminderAnchor
		if (!anchor) {
			return undefined
		}
		const epoch = (anchor as unknown as Date).getTime()
		if (!this.floating || !zone) {
			return epoch
		}
		return Temporal.Instant.fromEpochMilliseconds(epoch)
			.toZonedDateTimeISO('UTC')
			.toPlainDateTime()
			.toZonedDateTime(zone, { disambiguation: 'compatible' })
			.epochMilliseconds
	}

	/** Starts the reminders from `defaults`, following them across kind changes until the user sets their own. All-day entries get none. */
	adoptDefaultReminders(defaults: ReminderDefaults) {
		reminderDefaults.set(this, defaults)
		this.reminders = this.allDay || !this.reminderAnchor ? null : defaults.for(this.type)
	}

	/** The user's own reminders, which no default replaces. */
	setReminders(minutes: ReadonlyArray<number>) {
		reminderDefaults.delete(this)
		this.reminders = minutes.length ? [...new Set(minutes)].sort((a, b) => a - b) : null
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
	@property({ type: 'Date', nullable: true }) recurrenceId?: DateTime
	seriesStart?: DateTime

	relations?: Array<Relation> | null

	get relationList() {
		return EntryRelations.of(this.uid, this.relations)
	}

	/** Replaces the array, so snapshots stay immutable. */
	relateTo(type: RelationType | string, targetUid: string) {
		this.relations = this.relationList.adding(type, targetUid).value
	}

	/** An emptied list collapses to null. */
	unrelate(relation: Relation) {
		this.relations = this.relationList.without(relation).value
	}

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

		// Calendar days, so an all-day span across a DST change still reads as whole days.
		const { days, hours, minutes } = this.start.zonedDateTime.until(this.end.zonedDateTime, { largestUnit: 'days', smallestUnit: 'minutes' })
		return new Intl.DurationFormat(Localizer.locales.current, { style: 'narrow' }).format({ days, hours, minutes })
	}

	constructor(init?: Partial<Entry>) {
		Object.assign(this, init)
	}

	/** A local draft has no id until it is saved, so `!persisted` is what marks a draft. */
	get persisted() {
		return this.id !== undefined
	}

	get relatable() {
		return this.persisted && !!this.uid
	}

	/** Only a start places an entry: a due is a constraint, so a task with one but no start stays unscheduled. */
	get scheduled() {
		return !!this.start
	}

	/** The day a task is owed on: its due, else the last day its schedule occupies. */
	get lastDay() {
		return this.due?.dayStart ?? (!this.start ? undefined : this.inclusiveEnd.dayStart)
	}

	/**
	 * Whether an open task's day has gone by. Compared by day: one due this morning is still today's.
	 * A repeating task is never behind: the next occurrence settles the missed one.
	 */
	get overdue() {
		if (!this.type?.isTask || this.closed || this.partOfSeries) {
			return false
		}
		return !!this.lastDay && this.lastDay.isBefore(new DateTime().dayStart)
	}

	/**
	 * Whether the entry may lose its dates. DTSTART is required of a VEVENT (RFC 5545 §3.6.1), and a series' dates
	 * identify its occurrences. Undated rows a provider hands us still render, or the user could never fix them.
	 */
	get unschedulable() {
		return this.type.isTask && !this.partOfSeries
	}

	/** An expanded occurrence or a synced override of a series. */
	get isRecurring() {
		return !!this.recurrenceMasterId
	}

	/** Where "this and following" would reach the whole series. Both instants come from the expansion, so a synced override answers false. */
	get isSeriesStart() {
		return !!this.recurrenceId && !!this.seriesStart && this.recurrenceId.equals(this.seriesStart)
	}

	/** The master or one of its occurrences: never dragged, its schedule read-only in the editor (the rule stays editable). */
	get partOfSeries() {
		return !!this.recurrence || this.isRecurring
	}

	/** The row that holds what a whole series shares: its master, or the entry itself when it stands alone. */
	get masterId() {
		return this.recurrenceMasterId ?? this.id
	}

	editEquals(other: Entry) {
		const editable = ['sourceId', 'type', 'heading', 'description', 'location', 'color', 'start', 'end', 'due', 'estimate', 'allDay', 'timeZone', 'status', 'percentComplete', 'transparency', 'visibility', 'recurrence', 'reminders', 'participants'] as const
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
			due: this.due,
			estimate: this.estimate,
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
			due: values.due,
			estimate: values.estimate,
			status: values.status,
			percentComplete: values.percentComplete,
			rank: values.rank,
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

	/** Whether the task is planned at a moment only, with no end (taking a pill at 10:00). */
	get point() {
		return !!this.type?.isTask && !!this.start && !this.end
	}

	moveStart(start: DateTime) {
		if (this.point) {
			this.start = this.allDay ? start.dayStart : start
			return
		}
		if (this.allDay) {
			const day = start.dayStart
			const deltaDays = this.start!.zonedDateTime.toPlainDate().until(day.zonedDateTime.toPlainDate()).days
			this.end = this.effectiveEnd.add({ days: deltaDays })
			this.start = day
		} else {
			const duration = Math.max(this.effectiveEnd.valueOf() - this.start!.valueOf(), MINIMUM_DURATION_MINUTES * 60_000)
			this.start = start
			this.end = start.add({ milliseconds: duration })
		}
	}

	/** Schedules an unscheduled entry for as long as its estimate, else `durationMinutes` (a day when all-day). */
	scheduleAt(start: DateTime, allDay: boolean, durationMinutes: number) {
		this.setAllDay(allDay, durationMinutes)
		this.start = allDay ? start.dayStart : start
		this.end = allDay
			? this.start.add({ days: Math.max(1, Math.round(TimeSpan.fromMinutes(this.estimate ?? 0).days)) })
			: this.start.add({ minutes: this.estimate ?? durationMinutes })
		this.estimate = null
	}

	/** Takes the dates off; the span's length stays behind as the estimate. Reminders stay only while a due anchors them. */
	unschedule() {
		if (this.start && this.end) {
			// All-day spans count calendar days: one spanning a DST change lasts 47 or 49 hours.
			this.estimate = this.allDay
				? TimeSpan.fromDays(this.start.zonedDateTime.toPlainDate().until(this.effectiveEnd.zonedDateTime.toPlainDate()).days).minutes
				: Math.round(this.effectiveEnd.since(this.start).minutes)
		}
		this.start = undefined
		this.end = undefined
		if (!this.due) {
			this.reminders = null
		}
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

	migrateTo(source: Source) {
		this.sourceId = source.id
		if (!source.supportsEntryType(this.type)) {
			this.type = source.defaultEntryType
		}
	}

	spanEquals(other: Entry) {
		return this.allDay === other.allDay
			&& this.start?.valueOf() === other.start?.valueOf()
			&& this.end?.valueOf() === other.end?.valueOf()
	}

	/** The span, with the estimate that stands for it while there is none and the due, whose form follows the span's precision. */
	adoptSpan(other: Entry) {
		// Leaving the calendar drops reminders as unschedule() does, unless a due date still anchors them.
		if (this.scheduled && !other.scheduled && !other.due) {
			this.reminders = null
		}
		this.start = other.start
		this.end = other.end
		this.estimate = other.estimate
		this.allDay = other.allDay
		this.due = other.due
	}

	/** Takes over everything an edit can change, as an entry kept in Mitra's own database does. */
	adopt(edited: Entry) {
		this.heading = edited.heading
		this.description = edited.description
		this.location = edited.location
		this.color = edited.color
		this.adoptSpan(edited)
		this.timeZone = edited.timeZone
		this.status = edited.status
		this.percentComplete = edited.percentComplete
		this.transparency = edited.transparency
		this.visibility = edited.visibility
		this.reminders = edited.reminders
		this.participants = edited.participants
		this.recurrence = edited.recurrence
		if (edited.exdates !== undefined) {
			this.exdates = edited.exdates
		}
	}

	/** Excludes one occurrence of the series (RFC 5545 EXDATE). */
	exclude(recurrenceId: Date) {
		this.exdates = [...(this.exdates ?? []), recurrenceId.getTime()]
	}

	/** Re-zones entry while keeping wall-clock time. */
	setTimeZone(zone: string) {
		if (!this.allDay) {
			const from = this.floating ? 'UTC'
				: this.timeZone ?? TimeZone.deviceId
			// A date the entry lacks arrives as null from the wire, not undefined.
			const rezoned = (value: DateTime | undefined) => !value ? value : new DateTime(
				Temporal.Instant.fromEpochMilliseconds(value.valueOf())
					.toZonedDateTimeISO(from)
					.toPlainDateTime()
					.toZonedDateTime(zone, { disambiguation: 'compatible' })
					.epochMilliseconds,
			)
			this.start = rezoned(this.start)
			this.end = rezoned(this.end)
			this.due = rezoned(this.due)
		}
		this.timeZone = zone
	}

	/** Switches every date of the entry between days and times. A due keeps its day, and turns timed at the end of the working day. */
	setAllDay(allDay: boolean, durationMinutes: number) {
		if (allDay === this.allDay) {
			return
		}
		if (this.due) {
			this.due = allDay ? this.due.dayStart : this.due.dayStart.with({ hour: 17 })
		}
		this.allDay = allDay
		if (!this.start) {
			return
		}
		if (!this.end) {
			this.start = allDay ? this.start.dayStart : this.start.dayStart.with({ hour: 9 })
			return
		}
		if (allDay) {
			const firstDay = this.start.dayStart
			const lastDay = (this.end.valueOf() > this.start.valueOf() ? this.end : this.start).dayStart
			this.start = firstDay
			this.end = (lastDay.valueOf() > firstDay.valueOf() ? lastDay : firstDay).add({ days: 1 })
		} else {
			const at = this.start.dayStart.with({ hour: 9 })
			this.start = at
			this.end = at.add({ minutes: durationMinutes })
		}
	}
}
