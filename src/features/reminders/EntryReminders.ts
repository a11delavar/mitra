import { type Converter } from '@a11d/converter'
import { z } from 'zod'
import { Type } from '#infrastructure/model'

/** An entry's reminders, in minutes before its anchor: each once, in order, and none at all rather than an empty list. */
export class EntryReminders extends Array<number> {
	static override get [Symbol.species]() {
		return Array
	}

	/** These minutes as reminders, or none where there are none. */
	static normalize(minutes: Iterable<number> | null | undefined): EntryReminders | undefined {
		const unique = [...new Set(minutes ?? [])].sort((a, b) => a - b)
		if (!unique.length) {
			return undefined
		}
		const reminders = new EntryReminders()
		reminders.push(...unique)
		return reminders
	}

	/** On the wire as the list of its minutes; none at all, `[]` as much as `null`, clears them. */
	static readonly converter: Converter<ReadonlyArray<number> | null | undefined, EntryReminders | null | undefined> = {
		schema: z.array(z.number().int()),
		construct: value => value === undefined ? value : EntryReminders.normalize(value) ?? null,
	}

	/** In its JSON column as the list of its minutes. */
	static readonly Mapper = class extends Type<EntryReminders | undefined, string | null> {
		override convertToDatabaseValue(value: EntryReminders | null | undefined): string | null {
			return value?.length ? JSON.stringify([...value]) : null
		}

		override convertToJSValue(value: unknown): EntryReminders | undefined {
			return EntryReminders.normalize((typeof value === 'string' ? JSON.parse(value) : value) as ReadonlyArray<number> | null)
		}

		override getColumnType(): string {
			return 'json'
		}
	}

	/** These and `minutes`. */
	adding(minutes: number) {
		return EntryReminders.normalize([...this, minutes])
	}

	/** These without `minutes`, none where it was the last. */
	without(minutes: number) {
		return EntryReminders.normalize(this.filter(other => other !== minutes))
	}

	/** How far ahead of its anchor the first of them fires, in minutes. */
	get earliest() {
		return this.at(-1)!
	}
}
