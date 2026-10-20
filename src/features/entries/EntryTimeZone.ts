import { type Converter } from '@a11d/converter'
import { TimeZone } from '#features/time/TimeZone.js'
import { Type } from '#infrastructure/model'

/**
 * The clock an entry's times are written on (RFC 5545): a zone, or floating, the reader's own wall clock. An entry
 * without one follows its viewer. A zone keeps the id it was written with, as engines spell some differently
 * (`Asia/Kolkata`, `Asia/Calcutta`) and a provider expects its own back.
 */
export class EntryTimeZone {
	static readonly floating = new EntryTimeZone('floating')

	/** A zone from its id, or floating; anything else is none. */
	static parse(value: unknown): EntryTimeZone | undefined {
		return value instanceof EntryTimeZone ? value
			: value === EntryTimeZone.floating.id ? EntryTimeZone.floating
				: TimeZone.parse(value) ? new EntryTimeZone(value as string)
					: undefined
	}

	static of(zone: TimeZone) {
		return new EntryTimeZone(zone.id)
	}

	private constructor(readonly id: string) { }

	get floating() {
		return this === EntryTimeZone.floating
	}

	/** The zone it names; none when floating. */
	get zone(): TimeZone | undefined {
		return this.floating ? undefined : TimeZone.parse(this.id)
	}

	/** Where its wall clock is read: its zone, or UTC for floating times, which are stored as if in UTC. */
	get clock(): string {
		return this.floating ? 'UTC' : this.id
	}

	/** The same clock, whichever spelling of a zone each was written with. */
	equals(other: EntryTimeZone | null | undefined) {
		return !!other && (this === other || (!this.floating && !other.floating && !!this.zone?.equals(other.zone!)))
	}

	toString() {
		return this.id
	}

	static readonly converter: Converter<string | null | undefined, EntryTimeZone | null | undefined> = {
		construct: value => value === null ? value : EntryTimeZone.parse(value) ?? (value === undefined ? undefined : null),
		deconstruct: value => value?.id ?? value as null | undefined,
	}

	static readonly Mapper = class extends Type<EntryTimeZone | null, string | null> {
		override convertToDatabaseValue(value: EntryTimeZone | string | null | undefined) {
			return EntryTimeZone.parse(value)?.id ?? null
		}

		override convertToJSValue(value: EntryTimeZone | string | null | undefined) {
			return EntryTimeZone.parse(value) ?? null
		}

		override getColumnType() {
			return 'text'
		}
	}
}
