import { type Converter } from '@a11d/converter'
import { z } from 'zod'
import { Type } from '#infrastructure/model'
import { ValidationError } from '#infrastructure/validation'
import { TimeZone } from './TimeZone.js'

/**
 * The clock an entry's times are written on (RFC 5545): a zone, or floating, the reader's own wall clock. An entry
 * without one follows its viewer. A zone keeps the id it was written with, as engines spell some differently
 * (`Asia/Kolkata`, `Asia/Calcutta`) and a provider expects its own back.
 */
export class EntryTimeZone {
	static readonly floating = new EntryTimeZone('floating')

	/** A zone from its id, or floating; none where none is given; anything else is refused rather than read as none. */
	static parse(value: unknown): EntryTimeZone | undefined {
		if (value === null || value === undefined) {
			return undefined
		}
		if (value instanceof EntryTimeZone) {
			return value
		}
		if (value === EntryTimeZone.floating.id) {
			return EntryTimeZone.floating
		}
		if (TimeZone.parse(value)) {
			return new EntryTimeZone(value as string)
		}
		throw new ValidationError(`"${String(value)}" is not a time zone. Name an IANA zone (Europe/Berlin), or floating.`, ['timeZone'])
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

	/** Where its wall clock is read as stored: its zone, or UTC for floating times; the browser holds those in `TimeZone.local`. */
	get clock() {
		return this.floating ? TimeZone.UTC : TimeZone.of(this.id)
	}

	/** The same clock, whichever spelling of a zone each was written with. */
	equals(other: EntryTimeZone | null | undefined) {
		return !!other && (this === other || (!this.floating && !other.floating && !!this.zone?.equals(other.zone!)))
	}

	toString() {
		return this.id
	}

	/** The wire's null is a cleared zone, absent is none given; an unknown one is refused. */
	static readonly converter: Converter<string | null | undefined, EntryTimeZone | null | undefined> = {
		schema: z.string(),
		construct: value => value === null ? null : EntryTimeZone.parse(value),
		deconstruct: value => value?.id,
	}

	static readonly Mapper = class extends Type<EntryTimeZone | null, string | null> {
		override convertToDatabaseValue(value: EntryTimeZone | string | null | undefined) {
			return EntryTimeZone.parse(value)?.id ?? null
		}

		override convertToJSValue(value: EntryTimeZone | string | null | undefined) {
			try {
				return EntryTimeZone.parse(value) ?? null
			} catch {
				return null
			}
		}

		override getColumnType() {
			return 'text'
		}
	}
}
