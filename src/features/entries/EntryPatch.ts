import { construct, converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { type Entry } from './Entry.js'
import { EntryType } from './EntryType.js'
import { TaskStatus } from './TaskStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { EntryTimeZone } from './EntryTimeZone.js'
import { Recurrence } from '../recurrence/Recurrence.js'
import { Participants, type Participant } from '../participants/Participant.js'
import { EntryRelations } from '../relations/EntryRelations.js'
import { type Relation } from '../relations/Relation.js'

const date = {
	construct: (value: string | Date | null | undefined) => value === null || value === undefined ? value : new DateTime(value),
}

/**
 * An edit of an entry, which `Entry.apply` takes over: a field it leaves out keeps the entry's value, `null` clears it, and any
 * other value replaces it. Constructed from a request, it parses its fields, so a malformed one never reaches an entry.
 */
@model('EntryPatch')
export class EntryPatch {
	/** The fields an edit reaches, in the order they apply. */
	static readonly fields = [
		'sourceId', 'type', 'heading', 'description', 'location', 'color', 'allDay', 'start', 'end', 'due', 'estimate', 'timeZone',
		'status', 'percentComplete', 'transparency', 'visibility', 'recurrence', 'reminders', 'participants', 'relations',
	] as const satisfies ReadonlyArray<keyof Entry & keyof EntryPatch>

	/** What an edit through one occurrence of a repeating entry changes for all of them, its rule aside. */
	static readonly shared = ['heading', 'description', 'location', 'color', 'timeZone', 'transparency', 'visibility', 'reminders', 'participants'] as const satisfies ReadonlyArray<EntryPatchField>

	/** What an edit of one occurrence carries: neither its type nor its rule are its own. */
	static readonly occurrence = EntryPatch.fields.filter(field => field !== 'type' && field !== 'recurrence' && field !== 'relations')

	/** The given fields of `entry` as they stand, an empty one as cleared. */
	static of(entry: Entry, fields: ReadonlyArray<EntryPatchField> = EntryPatch.fields) {
		const patch = new EntryPatch()
		for (const field of fields) {
			// Relations alone tell unknown (absent) from none (null), so unknown ones stay out.
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
	@converter({ construct: EntryRelations.parse }) relations?: Array<Relation> | null | typeof EntryRelations.invalid

	/** Why the patch can't be applied, as a field came malformed. */
	get malformation() {
		return this.relations === EntryRelations.invalid ? 'Invalid relations'
			: this.recurrence && !this.recurrence.valid ? 'Invalid recurrence rule'
				: undefined
	}

	/** A whole, positive number of minutes, else none. */
	private static minutes(value: unknown) {
		return value === undefined ? value : typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
	}

	/** A percentage clamped to 0–100 (RFC 5545 §3.8.1.8), else none. */
	private static percent(value: unknown) {
		return value === undefined ? value : typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null
	}
}

export type EntryPatchField = typeof EntryPatch.fields[number]
