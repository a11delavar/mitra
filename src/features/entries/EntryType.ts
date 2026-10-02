import { type Converter } from '@a11d/converter'
import { Type } from '../../infrastructure/model/orm.js'

export type EntryTypeValue = 'event' | 'task' | 'availability'

/**
 * Value object representing an entry's domain type (event, task, or availability).
 */
export class EntryType {
	static readonly Event = new EntryType('event')
	static readonly Task = new EntryType('task')
	/** A recurring window of time, shaded behind the calendar's entries. Mitra stores it itself, in whichever calendar it belongs to. */
	static readonly Availability = new EntryType('availability')

	static readonly all: ReadonlyArray<EntryType> = [EntryType.Event, EntryType.Task, EntryType.Availability]

	static parse(value: EntryType | EntryTypeValue | string): EntryType {
		const parsed = EntryType.tryParse(value)
		if (!parsed) {
			throw new Error(`Unknown entry type: ${String(value)}`)
		}
		return parsed
	}

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

	get isAvailability() {
		return this === EntryType.Availability
	}

	format() {
		switch (this.value) {
			case 'event':
				return t('Event')
			case 'task':
				return t('Task')
			case 'availability':
				return t('Availability')
		}
	}

	formatPlural() {
		switch (this.value) {
			case 'event':
				return t('Events')
			case 'task':
				return t('Tasks')
			case 'availability':
				return t('Availability')
		}
	}

	toString() {
		return this.value
	}

	static readonly converter: Converter<EntryTypeValue | undefined, EntryType | undefined> = {
		construct: value => value === undefined ? undefined : EntryType.parse(value),
		deconstruct: value => value?.value,
	}

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
 * Collection representing types supported by a source.
 */
export class EntryTypes extends Array<EntryType> {
	static parse(values: Iterable<EntryType | EntryTypeValue | string>): EntryTypes {
		return EntryTypes.from(values, type => EntryType.parse(type))
	}

	static readonly converter: Converter<Array<EntryTypeValue>, ReadonlyArray<EntryType> | null | undefined> = {
		construct: value => value === undefined ? undefined : EntryTypes.parse(value),
		deconstruct: value => (value ?? []).map(type => type.value),
	}

	static readonly Mapper = class extends Type<EntryTypes, string> {
		override convertToDatabaseValue(value: Iterable<EntryType | string> | undefined | null): string {
			return JSON.stringify([...EntryTypes.parse(value ?? [])].map(type => type.value))
		}

		override convertToJSValue(value: string | Iterable<EntryType | string> | undefined | null): EntryTypes {
			return EntryTypes.parse(typeof value === 'string' ? JSON.parse(value) as Array<EntryTypeValue> : value ?? [])
		}

		override getColumnType(): string {
			return 'json'
		}
	}
}
