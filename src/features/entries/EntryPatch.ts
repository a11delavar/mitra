import { converter } from '@a11d/converter'
import { description } from '@a11d/metadata'
import { z } from 'zod'
import { Recurrence, EntryOccurrenceChangeScope } from '#features/recurrence'
import { Participants } from '#features/participants/Participant.js'
import { EntryReminders } from '#features/reminders/EntryReminders.js'
import { EntryRelations } from '#features/relations'
import { type Source, Color } from '#features/sources'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { TimeZone } from '#features/time/TimeZone.js'
import { model } from '#infrastructure/model'
import { validation, type Validatable, ValidationError } from '#infrastructure/validation'
import { Entry, type EntryClock } from './Entry.js'
import { EntryType } from './EntryType.js'
import { TaskStatus } from './TaskStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { EntryFiles } from './EntryFiles.js'

/** What a patch applies to: the entry it edits (none creates one), the calendar it is in, the calendar it goes to, and how far an occurrence's edit reaches. */
export interface EntryPatchContext {
	readonly entry?: Entry
	readonly from?: Source
	readonly to: Source
	readonly scope?: EntryOccurrenceChangeScope
}

/**
 * A date as `Entry` converts it, an all-day or floating one by the `allDay` and `timeZone` beside it; called at run time, as the two modules import
 * each other. Written as text it is an instant, a day, or a wall-clock time with its zone in brackets (RFC 9557), which
 * Temporal reads, daylight saving included. A day comes with `allDay: true`: read alone it would be a UTC midnight.
 */
const date = (field: 'start' | 'end' | 'due') => ({
	schema: z.union([z.iso.datetime({ offset: true }), z.iso.datetime({ offset: true, precision: -1 }), z.iso.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})?\[[^\]]+\]$/)]),
	construct: (value: string | Date | null | undefined, data: EntryClock) => {
		if (value === null || value === undefined) {
			return value
		}
		if (typeof value === 'string' && !value.includes('T') && !data.allDay) {
			throw new ValidationError(`"${value}" is a day: send allDay: true with it, or a time with its offset or zone.`, [field])
		}
		if (typeof value !== 'string' || !value.endsWith(']')) {
			return Entry.shownDay(new DateTime(value), data)
		}
		try {
			return Entry.shownDay(new DateTime(Temporal.ZonedDateTime.from(value).epochMilliseconds), data)
		} catch {
			throw new ValidationError(`"${value}" names no time zone Mitra knows.`)
		}
	},
	deconstruct: (value: Date | null | undefined, data: EntryClock) => Entry.storedDay(value, data),
})

/**
 * An edit of an entry, which `Entry.patch` takes over: a field it leaves out keeps the entry's value, `null` clears it, and any
 * other value replaces it. Constructed from a request, it parses its fields, so a malformed one never reaches an entry.
 */
@model('EntryPatch')
export class EntryPatch implements Validatable<EntryPatchContext | undefined> {
	/** The fields an edit reaches, in the order they apply. */
	static readonly fields = [
		'sourceId', 'type', 'heading', 'description', 'location', 'color', 'allDay', 'start', 'end', 'due', 'estimate', 'timeZone',
		'status', 'percentComplete', 'transparency', 'visibility', 'recurrence', 'reminders', 'participants', 'files', 'relations',
	] as const satisfies ReadonlyArray<keyof Entry & keyof EntryPatch>

	/** What an edit through one occurrence of a repeating entry changes for all of them, its rule aside. */
	static readonly shared = ['heading', 'description', 'location', 'color', 'timeZone', 'transparency', 'visibility', 'reminders', 'participants', 'files'] as const satisfies ReadonlyArray<EntryPatchField>

	/** What an edit of one occurrence carries: neither its type nor its rule are its own. */
	static readonly occurrence = EntryPatch.fields.filter(field => field !== 'type' && field !== 'recurrence' && field !== 'relations')

	/** The given fields of `entry` as they stand, an empty one as cleared. A date brings what tells how it travels: `allDay`, and a floating entry's zone. */
	static of(entry: Entry, fields: ReadonlyArray<EntryPatchField> = EntryPatch.fields) {
		const patch = new EntryPatch()
		const dated = fields.some(field => field === 'start' || field === 'end' || field === 'due')
		const travelling = !dated ? [] : (entry.floating ? ['allDay', 'timeZone'] as const : ['allDay'] as const).filter(field => !fields.includes(field))
		for (const field of [...travelling, ...fields]) {
			// Relations have a none of their own, an empty collection, so absent ones are unknown and stay out.
			if (field !== 'relations' || entry.relations !== undefined) {
				Object.assign(patch, { [field]: entry[field] ?? null })
			}
		}
		return patch
	}

	/** The patch creating `entry` where it was drafted: a time without a zone of its own is in the device's, never the account's home. */
	static creating(entry: Entry) {
		return Object.assign(EntryPatch.of(entry), { timeZone: entry.timeZone ?? EntryTimeZone.parse(TimeZone.deviceId) ?? null })
	}

	@validation(z.string().optional())
	@description('The calendar\'s id. Creating without one uses the default calendar; changing it moves the entry there.')
	sourceId?: string

	@validation(z.custom<EntryType>(value => value instanceof EntryType).optional())
	@description('An event happens at a time; a task is something to do, scheduled or not; availability is a window, usually repeating, when the person is free, or busy where it says so, shown behind the rest.')
	@converter(EntryType.converter)
	type?: EntryType

	@validation(z.string().nullish())
	@description('The title.')
	heading?: string | null

	@validation(z.string().nullish())
	@description('Markdown. Lines like "- [ ] step" are checklist items that count toward a task\'s progress.')
	description?: string | null

	@validation(z.string().nullish())
	location?: string | null

	@validation(z.custom<Color>(value => value instanceof Color).nullish())
	@description('A color in hex (#3366cc) or by its CSS name; null leaves it the color of its calendar.')
	@converter(Color.converter)
	color?: Color | null

	/** Days make an entry all-day where it does not say: its start's, else a due's when no start is written. */
	@validation(z.boolean().nullish())
	@description('Whether its dates are days rather than times; true with dates written as days.')
	allDay?: boolean | null

	@validation(z.date().nullish())
	@description('When it starts: an instant with its offset (2027-03-02T08:00Z), a wall-clock time with its zone (2027-03-02T09:00[Europe/Berlin]), or a day (2027-03-02) for an all-day entry, which needs allDay: true beside it. null takes the dates off a task, leaving it unscheduled.')
	@converter(date('start'))
	start?: DateTime | null

	@validation(z.date().nullish())
	@description('When it ends, written like start. An all-day entry ends on the day after its last (2027-03-03 for one day on 2027-03-02).')
	@converter(date('end'))
	end?: DateTime | null

	@validation(z.date().nullish())
	@description('A task\'s due date, written like start, a day with allDay: true: the day or time it must be done by, apart from when it is scheduled.')
	@converter(date('due'))
	due?: DateTime | null

	@validation(z.number().int().positive().nullish())
	@description('How long an unscheduled task will take, in minutes.')
	@converter({ construct: EntryPatch.minutes })
	estimate?: number | null

	@validation(z.custom<EntryTimeZone>(value => value instanceof EntryTimeZone).nullish())
	@description('The IANA zone the entry is kept in (Europe/Berlin), which a repeating entry repeats in; floating for the same wall-clock time wherever one is.')
	@converter({
		schema: z.string(),
		construct: (value: string | null | undefined) => {
			const parsed = value === null || value === undefined ? value : EntryTimeZone.parse(value)
			if (parsed === undefined && value !== undefined) {
				throw new ValidationError(`"${value}" is not a time zone. Name an IANA zone (Europe/Berlin), or floating.`, ['timeZone'])
			}
			return parsed
		},
		deconstruct: EntryTimeZone.converter.deconstruct,
	})
	timeZone?: EntryTimeZone | null

	@validation(z.custom<TaskStatus>(value => value instanceof TaskStatus).nullish())
	@description('A task\'s status.')
	@converter(TaskStatus.converter)
	status?: TaskStatus | null

	@validation(z.number().min(0).max(100).nullish())
	@converter({ construct: EntryPatch.percent })
	percentComplete?: number | null

	@validation(z.custom<Transparency>(value => value instanceof Transparency).nullish())
	@description('Whether the time counts as busy or free; without, an event is busy and availability free.')
	@converter(Transparency.converter)
	transparency?: Transparency | null

	@validation(z.custom<Visibility>(value => value instanceof Visibility).nullish())
	@converter(Visibility.converter)
	visibility?: Visibility | null

	@validation(z.custom<Recurrence>(value => value instanceof Recurrence).nullish())
	@description('An RFC 5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=MO,WE or FREQ=MONTHLY;COUNT=6. null stops it repeating.')
	@converter(Recurrence.converter)
	recurrence?: Recurrence | null

	@description('Minutes before the start, or an unscheduled task\'s due, to remind at. Creating without them gives the user\'s default reminders; an empty list gives none.')
	@converter(EntryReminders.converter)
	reminders?: EntryReminders | null

	@description('The people taking part, the whole list, each by email with an optional name, role and status. The user leads it as organizer (organizer: true, self: true) by an address get_context names; only the organizer changes the list. Whether people are told is up to the provider: a CalDAV server that schedules (RFC 6638) sends the invitations, changes and cancellations, a Mitra calendar tells no one.')
	@converter(Participants.converter)
	participants?: Participants | null

	/** None at all, `[]` as much as `null`, clears them. */
	@converter({ construct: (value: unknown) => value === undefined || value === null ? value : EntryFiles.of(value), deconstruct: (value: EntryFiles | null | undefined) => value === undefined ? value : !value?.length ? null : EntryFiles.converter.deconstruct!(value, {}) })
	files?: EntryFiles | null

	@description('The entry\'s own links to other entries, each by the other\'s uid: FINISHTOSTART when this entry cannot start until the other finishes, PARENT when it is a subtask of the other. The list replaces the links the entry has, so keep those it should keep; links pointing at it are the other entry\'s and are left as they are. null removes them all.')
	@converter(EntryRelations.writeConverter)
	relations?: EntryRelations

	/** What makes the patch invalid: a field that came malformed, and with a context what the edit may not do there. */
	*validate(context?: EntryPatchContext) {
		if (this.relations === EntryRelations.invalid) {
			yield new ValidationError('Invalid relations', ['relations'])
		}
		if (this.recurrence && !this.recurrence.valid) {
			yield new ValidationError('Invalid recurrence rule', ['recurrence'])
		}
		if (!context) {
			return
		}
		const { entry, to, scope } = context
		// What an occurrence's edit carries leaves them out (`EntryPatch.occurrence`): links belong to the entry as a whole.
		if (scope && this.relations !== undefined) {
			yield new ValidationError('Relations belong to the repeating entry as a whole, never to one of its occurrences. To relate the occurrences to each other, make them separate entries.', ['relations'])
		}
		const target = to.capabilities
		if (!entry) {
			if (!target.entries.create) {
				yield new ValidationError('This calendar cannot be written to from mitra')
			}
			if (this.files?.length && !target.entries.attach) {
				yield new ValidationError('This calendar does not take attachments', ['files'])
			}
			return
		}
		const from = context.from ?? to
		const current = from.capabilities
		const moving = to.id !== from.id
		const type = this.type ?? entry.type
		const recurrence = this.recurrence === undefined ? entry.recurrence : this.recurrence
		if (!current.entries.edit) {
			yield new ValidationError('This calendar cannot be edited from mitra')
		}
		if (this.heading !== undefined && (this.heading ?? '') !== entry.heading && !current.entries.rename) {
			yield new ValidationError('Entries in this calendar take their title from the provider and cannot be renamed', ['heading'])
		}
		if (moving && !target.entries.create) {
			yield new ValidationError('This calendar cannot be written to from mitra', ['sourceId'])
		}
		if (this.files !== undefined && !current.entries.attach && !(this.files ?? EntryFiles.of([])).equals(entry.attachments)) {
			yield new ValidationError('Attachments in this calendar cannot be changed from mitra', ['files'])
		}
		if (moving && !target.entries.attach && (this.files === undefined ? entry.attachments : this.files ?? EntryFiles.of([])).length) {
			yield new ValidationError('This calendar does not take attachments', ['sourceId'])
		}
		if (type !== entry.type && entry.partOfSeries) {
			yield new ValidationError('A recurring entry cannot change its type', ['type'])
		}
		// DTSTART is required of a VEVENT (RFC 5545 §3.6.1).
		if (this.start === null && entry.start && !type.isTask) {
			yield new ValidationError('An event must have a date', ['start'])
		}
		// What the rule iterates: the start, or the due of an unscheduled task. Only an occurrence leaving the rule may drop it.
		const anchor = entry.start ? 'start' : 'due'
		if (scope && scope !== EntryOccurrenceChangeScope.This && entry.recurrence && this[anchor] === null) {
			yield new ValidationError('A repeating entry cannot lose the date it repeats from', [anchor])
		}
		if (moving && scope !== EntryOccurrenceChangeScope.This && recurrence && !to.ownership.holds('recurrence')) {
			yield new ValidationError('This calendar cannot hold a repeating entry', ['recurrence'])
		}
	}

	/** A whole, positive number of minutes, else none. */
	private static minutes(value: unknown) {
		return value === undefined ? value : typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
	}

	/** A percentage clamped to 0-100 (RFC 5545 §3.8.1.8), else none. */
	private static percent(value: unknown) {
		return value === undefined ? value : typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null
	}
}

export type EntryPatchField = typeof EntryPatch.fields[number]
