import { DateTime } from '@3mo/date-time'
import { converter } from '@a11d/converter'
import { MarkdownLinks } from '#design/MarkdownLinks.js'
import { Source, Color, type Calendar } from '#features/sources'
import { Recurrence, EntryOccurrences } from '#features/recurrence'
import { Participants, type ParticipantRole, type Participant } from '#features/participants/Participant.js'
import { type Relation, type RelationInit, type RelationType, RelationEdge, EntryRelation, EntryRelations } from '#features/relations'
import { type ReminderDefaults } from '#features/reminders/ReminderDefaults.js'
import { TimeZone } from '#features/time/TimeZone.js'
import type { IntegrationOwnership } from '#integrations'
import { model, Entity, identity, equality, entity, primaryKey, property, enum as enumType, unique, manyToOne, children } from '#infrastructure/model'
import { type Validatable, ValidationError } from '#infrastructure/validation'
import { EntryType, type EntryTypeValue } from './EntryType.js'
import { TaskStatus } from './TaskStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { EntryTimeZone } from './EntryTimeZone.js'
import { EntryFiles } from './EntryFiles.js'
import { EntryFile } from './EntryFile.js'
import { EntryFileType } from './EntryFileType.js'
import { EntryRank } from './EntryRank.js'
import { Checklist } from './Checklist.js'
import { EntryPatch } from './EntryPatch.js'
import { EntryChange } from './EntryChange.js'

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

export interface EntryData {
	raw?: string
	etag?: string
	url?: string
	localWriteAt?: number
}

/** What says how an entry's dates travel, read from the entry or from what the wire carries of it: days, or a floating wall clock. */
export type EntryClock = { readonly allDay?: boolean | null, readonly timeZone?: unknown }

export const MINIMUM_DURATION_MINUTES = 15

/** The defaults an entry's reminders still follow, until the user sets their own. Kept off the entry so it is never persisted, cloned or sent. */
const reminderDefaults = new WeakMap<Entry, ReminderDefaults>()

@model('Entry')
@entity()
@unique({ properties: ['sourceId', 'uri', 'recurrenceId'] })
export class Entry extends Entity implements Validatable<Calendar> {
	@identity()
	@primaryKey({ type: 'string' }) id?: string

	@equality()
	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'cascade' }) sourceId!: string

	@property({ type: 'string', nullable: true }) uri?: string

	@property({ type: EntryType.Mapper, fieldName: 'type' })
	@converter({ type: EntryType.converter })
	private _type!: EntryType
	@equality()
	get type(): EntryType { return this._type }
	set type(value: EntryType | EntryTypeValue) {
		this._type = EntryType.parse(value)
		this.fitType()
		const defaults = reminderDefaults.get(this)
		if (defaults) {
			this.adoptDefaultReminders(defaults)
		}
	}

	/** Drops what the type can't hold. */
	private fitType() {
		if (this._type.isTask) {
			this.transparency = undefined
		} else {
			this.status = undefined
			this.percentComplete = undefined
			this.due = undefined
			this.estimate = undefined
		}
		if (this._type.isAvailability) {
			this.participants = undefined
			this.reminders = undefined
			this.attachments = undefined
		}
	}

	@equality()
	@property({ type: 'string' }) heading = ''

	@equality()
	@property({ type: 'string' }) description = ''

	@equality()
	@property({ type: 'string' }) location = ''

	@equality()
	@converter(Color.converter)
	@property({ type: Color.Mapper, nullable: true }) color?: Color

	@equality()
	@Entry.date() start?: DateTime

	@equality()
	@Entry.date() end?: DateTime

	/** Apart from the schedule. */
	@equality()
	@Entry.date() due?: DateTime

	/** A task's length in minutes while it has no start. The end is the same fact once it does, so one of the two is always empty. */
	@equality()
	@property({ type: 'number', nullable: true }) estimate?: number

	@equality()
	@converter(TaskStatus.converter)
	@enumType({ type: TaskStatus.Mapper, items: TaskStatus.all.map(String), nullable: true }) status?: TaskStatus

	/** Task PERCENT-COMPLETE (RFC 5545 §3.8.1.8), 0-100. */
	@equality()
	@property({ type: 'number', nullable: true }) percentComplete?: number

	/** Position in the manual order, owned by Mitra and never written to the provider. Only
	 * `PUT /entries/ranks` changes it, so it is no part of equality. */
	@converter(EntryRank.converter)
	@property({ type: EntryRank.Mapper, nullable: true }) rank?: EntryRank

	get progress(): number | undefined {
		return this.percentComplete === undefined ? undefined : this.percentComplete / 100
	}

	get checklist(): Checklist {
		return Checklist.of(this.description)
	}

	get done() { return this.status === TaskStatus.Done }
	set done(value) { this.status = value ? TaskStatus.Done : TaskStatus.ToDo }

	get closed() { return !!this.status?.closed }

	/** Drops what a calendar can't keep and is no refusal: the estimate, where none is held. */
	fit(ownership: Pick<IntegrationOwnership, 'holds'>) {
		if (!ownership.holds('estimate')) {
			this.estimate = undefined
		}
		return this
	}

	/** Writes 100% progress on Done if the provider supports `percentComplete` (RFC 5545 §3.8.1.8). */
	setStatus(status: TaskStatus, ownership: Pick<IntegrationOwnership, 'holds'>) {
		this.status = status
		if (status === TaskStatus.Done && ownership.holds('percentComplete')) {
			this.percentComplete = 100
		}
	}

	@equality()
	@converter(Transparency.converter)
	@enumType({ type: Transparency.Mapper, items: Transparency.all.map(String), nullable: true }) transparency?: Transparency

	@equality()
	@converter(Visibility.converter)
	@enumType({ type: Visibility.Mapper, items: Visibility.all.map(String), nullable: true }) visibility?: Visibility

	/** TRANSP with its default filled in: busy for events (RFC 5545), free for availability. */
	get showAs(): Transparency {
		return this.transparency ?? (this.type?.isAvailability ? Transparency.Free : Transparency.Busy)
	}

	@equality()
	@property({ type: 'boolean' }) allDay = false

	@equality()
	@converter(EntryTimeZone.converter)
	@property({ type: EntryTimeZone.Mapper, nullable: true }) timeZone?: EntryTimeZone

	/** Times on whatever clock the reader's is (RFC 5545 floating), stored as if in UTC: an alarm at 7:00 anywhere. */
	get floating() {
		return !this.allDay && !!this.timeZone?.floating
	}

	/** The zone its times are written in: none for an all-day entry, whose days are everyone's, nor for a floating one, as `floating` names no zone. */
	get zone(): TimeZone | undefined {
		return this.allDay ? undefined : this.timeZone?.zone
	}

	@property({ type: 'json', nullable: true }) data?: EntryData

	@equality()
	@property({ type: 'json', nullable: true }) reminders?: Array<number>

	get reminderAnchor() {
		return this.occurrences.single.reminderAnchor
	}

	get remindersAnchorToEnd() {
		return this.occurrences.single.remindersAnchorToEnd
	}

	/** Starts the reminders from `defaults`, following them across kind changes until the user sets their own. All-day entries get none. */
	adoptDefaultReminders(defaults: ReminderDefaults) {
		reminderDefaults.set(this, defaults)
		this.reminders = this.allDay || !this.reminderAnchor ? undefined : defaults.for(this.type) ?? undefined
	}

	/** The user's own reminders, which no default replaces. */
	setReminders(minutes: ReadonlyArray<number>) {
		reminderDefaults.delete(this)
		this.reminders = minutes.length ? [...new Set(minutes)].sort((a, b) => a - b) : undefined
	}

	@equality()
	@property({ type: Participants.Mapper, nullable: true })
	@converter(Participants.converter) participants?: Array<Participant>

	get participantList(): Participants | undefined {
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
		this.participants = this.participantList?.marked(role)
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
		this.participants = undefined
	}

	/** The files it carries, each as what it is to the entry (`type`) and in its place (`rank`); a list set is saved as their rows. */
	// `EntryFiles` is read lazily: it imports `EntryFile`, which imports this module, so it may not be defined yet when this class is.
	@equality()
	@converter({ construct: (value: ReadonlyArray<object> | undefined) => EntryFiles.of(value), deconstruct: (files: EntryFiles) => EntryFiles.converter.deconstruct!(files, {}) })
	@children(() => EntryFile, file => file.entry, { eager: true, orphanRemoval: true, orderBy: { rank: 'asc' }, as: () => EntryFiles, saves: true })
	files!: EntryFiles

	/** Its attachments among {@link files}; setting them replaces those and leaves its other files alone. */
	get attachments(): EntryFiles { return this.files.ofType(EntryFileType.Attachment) }

	/** Takes `file` off the entry, with what the description showed of it: a link or picture of a file no longer here would dangle. */
	detach(file: EntryFile) {
		this.attachments = this.attachments.without(file)
		this.description = MarkdownLinks.without(this.description, href => file.isAt(href))
	}

	/** Whether the description embeds `file`, as a picture or a link. */
	embeds(file: EntryFile) {
		return MarkdownLinks.mentions(this.description, href => file.isAt(href))
	}

	/** Embeds `file` at the end of the description, a picture by its kind, else a link, by the public URL other apps read; once. */
	embed(file: EntryFile, origin: string) {
		if (this.embeds(file)) {
			return
		}
		const reference = `${file.mimeType?.type === 'image' ? '!' : ''}[${file.displayName}](${file.url(origin)})`
		this.description = [this.description?.trim(), reference].filter(Boolean).join('\n\n')
	}

	/** The links the description holds to anywhere but the entry's own files, which the attachments row already shows. */
	get links() {
		return MarkdownLinks.of(this.description).filter(link => !this.files.at(link.href))
	}

	set attachments(value: EntryFiles | undefined) { this.files = this.files.replacing(EntryFileType.Attachment, value) }

	@property({ type: 'string', nullable: true }) uid?: string

	@equality()
	@property({ type: Recurrence.Mapper, nullable: true })
	@converter(Recurrence.converter) recurrence?: Recurrence

	@Entry.days()
	@property({ type: 'json', nullable: true }) exdates?: Array<number>

	/** A recurring entry's overrides (RFC 5545 RECURRENCE-ID), each standing in for one of its dates; read with it, stored as rows of their own. */
	overrides?: Array<Entry>

	@property({ type: 'string', nullable: true }) recurringEntryId?: string

	@Entry.date() recurrenceId?: DateTime

	/** Unknown while absent, as a provider may not say; none is an empty collection. The lines it owns are saved as rows, those pointing at it a read attaches. */
	@converter(EntryRelations.converter)
	@children(() => EntryRelation, row => row.entryId, {
		eager: true,
		orphanRemoval: true,
		as: () => EntryRelations,
		rows: relations => relations.writes.map(relation => EntryRelation.of(relation)),
		unknown: true,
		saves: true,
	}) relations?: EntryRelations

	relateTo(type: RelationType | string, targetUid: string) {
		this.relations = (this.relations ?? EntryRelations.none).adding(type, targetUid, this.uid)
	}

	unrelate(relation: RelationInit) {
		this.relations = (this.relations ?? EntryRelations.none).without(relation)
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

	/**
	 * The entry holds an all-day date as the midnight that begins its day in `TimeZone.local`, and a floating time as the instant its
	 * wall clock reads there; the wire carries the day's UTC midnight and the wall clock as if in UTC. The conversion reads
	 * `allDay` and `timeZone` from the same entry, so it runs only at the wire, whatever order the fields come in.
	 */
	static date(options: { persist?: boolean } = {}): PropertyDecorator {
		return (prototype, key) => {
			converter({ construct: Entry.shownDay, deconstruct: Entry.storedDay })(prototype, key)
			if (options.persist !== false) {
				property({ type: 'Date', nullable: true })(prototype as never, String(key))
			}
		}
	}

	/** A list of dates, as {@link date} converts one. */
	static days(): PropertyDecorator {
		return converter({
			construct: (value: ReadonlyArray<number> | null | undefined, data: EntryClock) => value?.map(ms => Entry.shownDay(new Date(ms), data)!.valueOf()),
			deconstruct: (value: ReadonlyArray<number> | null | undefined, data: EntryClock) => value?.map(ms => Entry.storedDay(new Date(ms), data)!.valueOf()),
		})
	}

	/** Whether the dates of `data`, an entry or what the wire carries of one, are a floating wall clock's. */
	private static floats(data: EntryClock) {
		return !data.allDay && !!EntryTimeZone.parse(data.timeZone)?.floating
	}

	/** A date the wire carries, as `TimeZone.local` holds it: a day as the midnight that begins it there, a floating time at its wall clock there. */
	static shownDay(value: Date | string | null | undefined, data: EntryClock) {
		const zone = TimeZone.local
		return !zone || !value ? value
			: data.allDay ? new DateTime(zone.midnightOf(TimeZone.UTC.dayOf(new Date(value))).getTime())
				: Entry.floats(data) ? new DateTime(zone.atWallClockOf(new Date(value), TimeZone.UTC).getTime())
					: value
	}

	/** A date `TimeZone.local` holds, as the wire carries it: a day as its UTC midnight, a floating time's wall clock as if in UTC. */
	static storedDay(value: Date | string | null | undefined, data: EntryClock) {
		const zone = TimeZone.local
		return !zone || !value ? value
			: data.allDay ? TimeZone.UTC.midnightOf(zone.dayOf(new Date(value)))
				: Entry.floats(data) ? TimeZone.UTC.atWallClockOf(new Date(value), zone)
					: value
	}

	constructor(init?: Partial<Entry>) {
		super()
		Object.assign(this, init)
	}

	/** A local draft has no id until it is saved, so `!persisted` is what marks a draft. */
	get persisted() {
		return this.id !== undefined
	}

	get relatable() {
		return this.persisted && !!this.uid
	}

	// The date facts are its own dates' (its single occurrence's), so the formulas live once.

	get scheduled() {
		return this.occurrences.single.scheduled
	}

	get lastDay() {
		return this.occurrences.single.lastDay
	}

	get overdue() {
		return this.occurrences.single.overdue
	}

	/**
	 * DTSTART is required of a VEVENT (RFC 5545 §3.6.1), and a series' dates identify its occurrences.
	 * Undated rows a provider hands us still render, or the user could never fix them.
	 */
	get unschedulable() {
		return this.type.isTask && !this.partOfSeries
	}

	/** An expanded occurrence or a synced override of a series. */
	get isRecurring() {
		return !!this.recurringEntryId
	}

	/** The master or one of its occurrences: never dragged, its schedule read-only in the editor (the rule stays editable). */
	get partOfSeries() {
		return !!this.recurrence || this.isRecurring
	}

	/** The dates it takes place on, lazily: its own, or each its rule yields. */
	get occurrences() {
		return EntryOccurrences.of(this)
	}

	/** The row that holds what a whole series shares: its master, or the entry itself when it stands alone. */
	get masterId() {
		return this.recurringEntryId ?? this.id
	}

	/** A standalone copy: one that stands alone, without the rule, with the relationships this entry owns. */
	duplicate() {
		const duplicate = this.copy()
		duplicate.recurrence = undefined
		duplicate.relations = this.relations?.owned
		return duplicate
	}

	get multiDay() {
		return this.occurrences.single.multiDay
	}

	get effectiveEnd() {
		return this.occurrences.single.effectiveEnd
	}

	get inclusiveEnd() {
		return this.occurrences.single.inclusiveEnd
	}

	/** Whether the task is planned at a moment only, with no end (taking a pill at 10:00). */
	get point() {
		return this.occurrences.single.point
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
		this.estimate = undefined
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
			this.reminders = undefined
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
			this.reminders = undefined
		}
		this.start = other.start
		this.end = other.end
		this.estimate = other.estimate
		this.allDay = other.allDay
		this.due = other.due
	}

	/** What keeps the entry out of `calendar`: a type it can't hold, and every fact it can't store. */
	*validate({ source, integration }: Calendar) {
		const { ownership } = integration
		if (!integration.canHold(source, this.type)) {
			yield new ValidationError(`This calendar cannot hold ${this.type.isTask ? 'tasks' : this.type.isAvailability ? 'availability' : 'events'}`, ['type'])
		}
		if (this.participants?.length && !ownership.holds('participants')) {
			yield new ValidationError('This calendar does not support participants', ['participants'])
		}
		if (this.attachments.length && !ownership.holds('attachments')) {
			yield new ValidationError('This calendar does not support attachments', ['attachments'])
		}
		if (this.transparency === Transparency.Free && !ownership.holds('transparency')) {
			yield new ValidationError('This calendar cannot mark an entry as free', ['transparency'])
		}
		if (this.visibility && !ownership.holds('visibility')) {
			yield new ValidationError('This calendar does not support visibility', ['visibility'])
		}
		if (this.percentComplete !== undefined && !ownership.holds('percentComplete')) {
			yield new ValidationError('This calendar does not support task progress', ['percentComplete'])
		}
		if (this.due && !ownership.holds('due')) {
			yield new ValidationError('This calendar does not support due dates', ['due'])
		}
		if (this.relations?.writes.length && !ownership.holds('relations')) {
			yield new ValidationError('This calendar does not support relations between entries', ['relations'])
		}
		if (this.start && this.end && this.end.valueOf() < this.start.valueOf()) {
			yield new ValidationError('An entry cannot end before it starts', ['end'])
		}
	}

	/** What `patch` does to this entry, the entry itself rather than one of its occurrences. */
	edit(patch: EntryPatch) {
		return new EntryChange(this, new Entry().patch(EntryPatch.of(this)).patch(patch))
	}

	/** Takes over what `patch` sets, and a new entry's value where it clears. What the type can't hold goes, and an estimate a start replaced. */
	patch(patch: EntryPatch) {
		const cleared = new Entry()
		for (const field of EntryPatch.fields) {
			const value = patch[field]
			if (value !== undefined) {
				Object.assign(this, { [field]: value ?? cleared[field] })
			}
		}
		this.fitType()
		if (this.start) {
			this.estimate = undefined
		}
		return this
	}

	/** Excludes one occurrence of the series (RFC 5545 EXDATE). */
	exclude(recurrenceId: Date) {
		this.exdates = [...(this.exdates ?? []), recurrenceId.getTime()]
	}

	/** Re-zones entry while keeping wall-clock time. */
	setTimeZone(zone: EntryTimeZone) {
		if (!this.allDay) {
			const clockOf = (timeZone: EntryTimeZone) => timeZone.floating ? TimeZone.localOrDefault.id : timeZone.clock
			const from = this.timeZone ? clockOf(this.timeZone) : TimeZone.deviceId
			const rezoned = (value: DateTime | undefined) => !value ? value : new DateTime(
				Temporal.Instant.fromEpochMilliseconds(value.valueOf())
					.toZonedDateTimeISO(from)
					.toPlainDateTime()
					.toZonedDateTime(clockOf(zone), { disambiguation: 'compatible' })
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
