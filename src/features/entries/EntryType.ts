import { type Converter } from '@a11d/converter'
import { Type } from '../../infrastructure/model/orm.js'

/** An entry type as JSON and the database carry it — the only form that crosses either boundary. */
export type EntryTypeValue = 'event' | 'task'

/**
 * WHAT an entry is: an event or a task. A value object with a private constructor rather than a bare
 * enum, so the type can carry its own behaviour (`isTask`, its labels' vocabulary, tomorrow an
 * availability frame's rules) instead of every consumer re-deriving it from a string — and so there is
 * exactly ONE instance per type, which makes `===` the whole comparison story.
 *
 * It still LOOKS like a string everywhere it has to, through the two conversions it carries itself:
 * - {@link Mapper} stores it as that value in a text column, so the schema is unchanged;
 * - {@link converter} carries it as that value across the API, so a response says `"type": "task"`;
 * - `toString` yields {@link EntryTypeValue} too, so a template interpolates the same word it always did.
 *
 * The reverse crossing is {@link parse}, which both conversions run incoming values through — and which
 * `Entry.type`'s setter also accepts, so assigning a raw string there still lands as the instance.
 *
 * Adding a type (an availability frame, a journal note) means one more static here plus whatever the
 * providers map it to — no consumer has to learn a new string.
 */
export class EntryType {
	static readonly Event = new EntryType('event')
	static readonly Task = new EntryType('task')

	/** Every type there is, in the order the UI offers them — calendar-first, like mitra itself. */
	static readonly all: ReadonlyArray<EntryType> = [EntryType.Event, EntryType.Task]

	/** The instance for a wire/column value. An `EntryType` passes straight through, so a boundary may
	 * hand over whatever it holds without checking first. Throws on anything unknown — a type mitra
	 * doesn't model must never silently become an event. */
	static parse(value: EntryType | EntryTypeValue | string): EntryType {
		const parsed = EntryType.tryParse(value)
		if (!parsed) {
			throw new Error(`Unknown entry type: ${String(value)}`)
		}
		return parsed
	}

	/** {@link parse}, but `undefined` instead of a throw — for a request boundary that owes the client a
	 * 400 rather than a 500. */
	static tryParse(value: unknown): EntryType | undefined {
		return value instanceof EntryType ? value : EntryType.all.find(type => type.value === value)
	}

	private constructor(readonly value: EntryTypeValue) { }

	get isEvent() {
		return this === EntryType.Event
	}

	get isTask() {
		return this === EntryType.Task
	}

	/** What this type is called in the interface — ONE entry of it ("Event"), and the type itself in the
	 * plural ("Events"), for naming what a source holds. FRONTEND-ONLY: `t()` is a frontend global, so
	 * these must never be called from backend code (the same rule the provider `description` statics
	 * follow — see AGENTS.md); `scripts/i18n.ts` scans shared translation calls, so these keys stay tracked. */
	format() {
		switch (this.value) {
			case 'event':
				return t('Event')
			case 'task':
				return t('Task')
		}
	}

	formatPlural() {
		switch (this.value) {
			case 'event':
				return t('Events')
			case 'task':
				return t('Tasks')
		}
	}

	toString() {
		return this.value
	}

	/** Carries ONE type across the API as its value, so a response says `"type": "task"` and comes back
	 * as the instance. Absent stays absent — a payload that never mentions the type must not overwrite
	 * what the instance already holds. */
	static readonly converter: Converter<EntryTypeValue | undefined, EntryType | undefined> = {
		construct: value => value === undefined ? undefined : EntryType.parse(value),
		deconstruct: value => value?.value,
	}

	/** Persists ONE type as its value in a text column — what `Entry.type` has always been on disk, so
	 * the schema doesn't change and a hydrated row comes back as the instance. */
	static readonly Mapper = class extends Type<EntryType, string> {
		override convertToDatabaseValue(value: EntryType | string): string {
			return EntryType.parse(value).value
		}

		override convertToJSValue(value: EntryType | string): EntryType {
			return EntryType.parse(value)
		}

		override getColumnType(): string {
			return 'text'
		}
	}
}

/**
 * The types one source can hold — `Source.entryTypes`, and the home for how that list crosses both
 * boundaries. A real class rather than a bare array so those two conversions live WITH the thing they
 * convert, next to {@link EntryType}'s own.
 *
 * Deliberately no instance methods: every call site builds one as a plain literal
 * (`entryTypes: [EntryType.Event]`), which is structurally an `EntryTypes` to TypeScript but has none
 * of its methods at runtime. What a list means for a source — {@link Source.supportsEntryType},
 * {@link Source.defaultEntryType} — therefore stays on `Source`, where the answer is never in doubt.
 */
export class EntryTypes extends Array<EntryType> {
	/** The instances for a list of wire/column values. Tolerates instances, so a boundary may hand over
	 * whatever it holds. */
	static parse(values: Iterable<EntryType | EntryTypeValue | string>): EntryTypes {
		return EntryTypes.from(values, type => EntryType.parse(type))
	}

	/** {@link EntryType.converter} for the list. A missing one leaves the source's own default alone,
	 * while an absent one goes out as `[]`: every consumer reads that as "unknown, so accept
	 * everything" (see {@link Source.supportsEntryType}), and dropping the key instead would leave the
	 * client guessing. */
	static readonly converter: Converter<Array<EntryTypeValue>, ReadonlyArray<EntryType> | null | undefined> = {
		construct: value => value === undefined ? undefined : EntryTypes.parse(value),
		deconstruct: value => (value ?? []).map(type => type.value),
	}

	/** Persists the list as a JSON array of values (`["event","task"]`). A NULL column reads as the
	 * empty list, making a row written before the column existed harmless. */
	static readonly Mapper = class extends Type<EntryTypes, string> {
		override convertToDatabaseValue(value: Iterable<EntryType | string> | undefined | null): string {
			return JSON.stringify([...EntryTypes.parse(value ?? [])].map(type => type.value))
		}

		override convertToJSValue(value: string | Iterable<EntryType | string> | undefined | null): EntryTypes {
			// The driver may hand over the raw JSON text or an already-parsed array, depending on the column's
			// declared type — accept both rather than depending on which.
			return EntryTypes.parse(typeof value === 'string' ? JSON.parse(value) as Array<EntryTypeValue> : value ?? [])
		}

		override getColumnType(): string {
			return 'json'
		}
	}
}
