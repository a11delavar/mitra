import { Type } from './orm.js'

/** An entry type as JSON and the database carry it — the only form that crosses either boundary. */
export type EntryTypeValue = 'event' | 'task'

/**
 * WHAT an entry is: an event or a task. A value object with a private constructor rather than a bare
 * enum, so the type can carry its own behaviour (`isTask`, its labels' vocabulary, tomorrow an
 * availability frame's rules) instead of every consumer re-deriving it from a string — and so there is
 * exactly ONE instance per type, which makes `===` the whole comparison story.
 *
 * It still LOOKS like a string everywhere it has to:
 * - `toJSON` (and `toString`) yield {@link EntryTypeValue}, so an API response says `"type": "task"`
 *   and a template interpolates the same word it always did;
 * - {@link EntryTypeMapper} stores it as that value in a text column, so the schema is unchanged;
 * - the reverse crossing is {@link parse} — the setters at each boundary (`Entry.type`,
 *   `Source.entryTypes`) run incoming strings through it, which is what lets the frontend's API reviver
 *   hand a raw `"task"` to an entity and still end up with the instance.
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

	toJSON() {
		return this.value
	}
}

/** Persists ONE {@link EntryType} as its value in a text column — what `Entry.type` has always been on
 * disk, so the schema doesn't change and a hydrated row comes back as the instance. */
export class EntryTypeMapper extends Type<EntryType, string> {
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

/** Persists a LIST of types as a JSON array of values (`["event","task"]`) — `Source.entryTypes`. A
 * NULL column reads as the empty list, which every consumer treats as "unknown, so accept everything"
 * (see `Source.supports`), making a row written before the column existed harmless. */
export class EntryTypesMapper extends Type<Array<EntryType>, string> {
	override convertToDatabaseValue(value: Array<EntryType | string> | undefined): string {
		return JSON.stringify((value ?? []).map(type => EntryType.parse(type).value))
	}

	override convertToJSValue(value: string | Array<EntryType | string> | undefined): Array<EntryType> {
		// The driver may hand over the raw JSON text or an already-parsed array, depending on the column's
		// declared type — accept both rather than depending on which.
		const values = typeof value === 'string' ? JSON.parse(value) as Array<EntryTypeValue> : value ?? []
		return values.map(type => EntryType.parse(type))
	}

	override getColumnType(): string {
		return 'json'
	}
}
