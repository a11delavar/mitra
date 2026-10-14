import { construct, converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { Entry } from './Entry.js'
import { EntryType } from './EntryType.js'
import { TaskStatus } from './TaskStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { EntryTimeZone } from './EntryTimeZone.js'
import { Recurrence } from '../recurrence/Recurrence.js'
import { Participants, type Participant } from '../participants/Participant.js'
import { EntryRelations } from '../relations/EntryRelations.js'
import { type Calendar } from '../sources/Calendar.js'
import { type Validatable } from '../../infrastructure/validation/Validatable.js'
import { ValidationError } from '../../infrastructure/validation/ValidationError.js'
import { type EntryOccurrenceChangeScope } from '../recurrence/EntryOccurrenceChange.js'

/** What a patch applies to: the entry it edits (none creates one), the calendar it is in, the calendar it goes to, and how far an occurrence's edit reaches. */
export interface EntryPatchContext {
	readonly entry?: Entry
	readonly from?: Calendar
	readonly to: Calendar
	readonly scope?: EntryOccurrenceChangeScope
}

/** A date as `Entry` converts it, an all-day one by the `allDay` beside it; called at run time, as the two modules import each other. */
const date = {
	construct: (value: string | Date | null | undefined, data: { allDay?: boolean | null }) => value === null || value === undefined ? value : Entry.shownDay(new DateTime(value), data),
	deconstruct: (value: Date | null | undefined, data: { allDay?: boolean | null }) => Entry.storedDay(value, data),
}

/**
 * An edit of an entry, which `Entry.apply` takes over: a field it leaves out keeps the entry's value, `null` clears it, and any
 * other value replaces it. Constructed from a request, it parses its fields, so a malformed one never reaches an entry.
 */
@model('EntryPatch')
export class EntryPatch implements Validatable<EntryPatchContext | undefined> {
	/** The fields an edit reaches, in the order they apply. */
	static readonly fields = [
		'sourceId', 'type', 'heading', 'description', 'location', 'color', 'allDay', 'start', 'end', 'due', 'estimate', 'timeZone',
		'status', 'percentComplete', 'transparency', 'visibility', 'recurrence', 'reminders', 'participants', 'relations',
	] as const satisfies ReadonlyArray<keyof Entry & keyof EntryPatch>

	/** What an edit through one occurrence of a repeating entry changes for all of them, its rule aside. */
	static readonly shared = ['heading', 'description', 'location', 'color', 'timeZone', 'transparency', 'visibility', 'reminders', 'participants'] as const satisfies ReadonlyArray<EntryPatchField>

	/** What an edit of one occurrence carries: neither its type nor its rule are its own. */
	static readonly occurrence = EntryPatch.fields.filter(field => field !== 'type' && field !== 'recurrence' && field !== 'relations')

	/** The given fields of `entry` as they stand, an empty one as cleared. A date brings `allDay`, which tells how it travels. */
	static of(entry: Entry, fields: ReadonlyArray<EntryPatchField> = EntryPatch.fields) {
		const patch = new EntryPatch()
		const dated = fields.some(field => field === 'start' || field === 'end' || field === 'due')
		for (const field of dated && !fields.includes('allDay') ? ['allDay' as const, ...fields] : fields) {
			// Relations have a none of their own, an empty collection, so absent ones are unknown and stay out.
			if (field !== 'relations' || entry.relations !== undefined) {
				Object.assign(patch, { [field]: entry[field] ?? null })
			}
		}
		return patch
	}

	/** What a request carried, as a patch. Only the fields an edit reaches are read. */
	static from(body: unknown) {
		if (body instanceof EntryPatch) {
			return body
		}
		const sent = (body ?? {}) as Record<string, unknown>
		return construct(EntryPatch, Object.fromEntries(EntryPatch.fields.filter(field => field in sent).map(field => [field, sent[field]])))
	}

	sourceId?: string
	@converter(EntryType.converter) type?: EntryType
	heading?: string | null
	description?: string | null
	location?: string | null
	color?: string | null
	allDay?: boolean | null
	@converter(date) start?: DateTime | null
	@converter(date) end?: DateTime | null
	@converter(date) due?: DateTime | null
	@converter({ construct: EntryPatch.minutes }) estimate?: number | null
	@converter(EntryTimeZone.converter) timeZone?: EntryTimeZone | null
	@converter(TaskStatus.converter) status?: TaskStatus | null
	@converter({ construct: EntryPatch.percent }) percentComplete?: number | null
	@converter(Transparency.converter) transparency?: Transparency | null
	@converter(Visibility.converter) visibility?: Visibility | null
	@converter({ construct: (value: Partial<Recurrence> | null | undefined) => value === null ? value : Recurrence.from(value) }) recurrence?: Recurrence | null
	reminders?: Array<number> | null
	@converter({ construct: (value: ReadonlyArray<Partial<Participant>> | null | undefined) => value === undefined ? value : Participants.normalize(value) }) participants?: Array<Participant> | null
	@converter({ construct: EntryRelations.parse, deconstruct: EntryRelations.converter.deconstruct }) relations?: EntryRelations

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
		const target = to.integration.capabilitiesFor(to.source)
		if (!entry) {
			if (!target.entries.create) {
				yield new ValidationError('This calendar cannot be written to from mitra')
			}
			return
		}
		const from = context.from ?? to
		const current = from.integration.capabilitiesFor(from.source)
		const moving = to.source.id !== from.source.id
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
		if (type !== entry.type && entry.partOfSeries) {
			yield new ValidationError('A recurring entry cannot change its type', ['type'])
		}
		// DTSTART is required of a VEVENT (RFC 5545 §3.6.1).
		if (this.start === null && entry.start && !type.isTask) {
			yield new ValidationError('An event must have a date', ['start'])
		}
		// What the rule iterates: the start, or the due of an unscheduled task. Only an occurrence leaving the rule may drop it.
		const anchor = entry.start ? 'start' : 'due'
		if (scope && scope !== 'this' && entry.recurrence && this[anchor] === null) {
			yield new ValidationError('A repeating entry cannot lose the date it repeats from', [anchor])
		}
		if (moving && scope !== 'this' && recurrence && !to.integration.ownership.holds('recurrence')) {
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
