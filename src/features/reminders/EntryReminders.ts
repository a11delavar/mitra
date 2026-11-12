import { type Converter } from '@a11d/converter'
import { z } from 'zod'
import { Type } from '#infrastructure/model'

/** One reminder: how far ahead of its anchor it fires, and whether the calendar's server sends it as an email rather than Mitra pushing it. */
export class EntryReminder {
	constructor(readonly minutes: number, readonly email = false) { }
}

/** A reminder as written: its minutes, or an email one as `{ minutes, email: true }`. */
type WrittenReminder = number | { readonly minutes: number, readonly email: true }

/** An entry's reminders, in minutes before its anchor: each once, in order, and none at all rather than an empty list. */
export class EntryReminders extends Array<EntryReminder> {
	static override get [Symbol.species]() {
		return Array
	}

	/** These reminders, plain minutes pushed, or none where there are none; of two at the same minutes the first stays. */
	static normalize(reminders: Iterable<WrittenReminder | EntryReminder> | null | undefined): EntryReminders | undefined {
		const byMinutes = new Map<number, EntryReminder>()
		for (const reminder of reminders ?? []) {
			const { minutes, email } = typeof reminder === 'number' ? new EntryReminder(reminder) : reminder
			byMinutes.has(minutes) ? void 0 : byMinutes.set(minutes, new EntryReminder(minutes, email))
		}
		if (!byMinutes.size) {
			return undefined
		}
		const normalized = new EntryReminders()
		normalized.push(...[...byMinutes.values()].sort((a, b) => a.minutes - b.minutes))
		return normalized
	}

	private static readonly schema = z.array(z.union([z.number().int(), z.object({ minutes: z.number().int(), email: z.literal(true) })]))

	private static written(reminders: EntryReminders): Array<WrittenReminder> {
		return reminders.map(({ minutes, email }) => email ? { minutes, email } : minutes)
	}

	/** On the wire as the list of its minutes, an email one as `{ minutes, email: true }`; none at all, `[]` as much as `null`, clears them. */
	static readonly converter: Converter<ReadonlyArray<WrittenReminder> | null | undefined, EntryReminders | null | undefined> = {
		schema: EntryReminders.schema,
		construct: value => value === undefined ? value : EntryReminders.normalize(value) ?? null,
		deconstruct: value => !value ? value : EntryReminders.written(value),
	}

	/** In its JSON column as written on the wire. */
	static readonly Mapper = class extends Type<EntryReminders | undefined, string | null> {
		override convertToDatabaseValue(value: EntryReminders | null | undefined): string | null {
			return value?.length ? JSON.stringify(EntryReminders.written(value)) : null
		}

		override convertToJSValue(value: unknown): EntryReminders | undefined {
			return EntryReminders.normalize((typeof value === 'string' ? JSON.parse(value) : value) as ReadonlyArray<WrittenReminder> | null)
		}

		override getColumnType(): string {
			return 'json'
		}
	}

	/** These and a pushed one `minutes` before. */
	adding(minutes: number) {
		return EntryReminders.normalize([...this, minutes])
	}

	/** These without the one `minutes` before, none where it was the last. */
	without(minutes: number) {
		return EntryReminders.normalize(this.filter(other => other.minutes !== minutes))
	}

	/** These with the one `minutes` before sent by email if it was pushed, else pushed. */
	toggled(minutes: number) {
		return EntryReminders.normalize(this.map(other => other.minutes !== minutes ? other : new EntryReminder(minutes, !other.email)))
	}

	/** How far ahead of its anchor the first of them fires, in minutes. */
	get earliest() {
		return this.at(-1)!.minutes
	}
}
