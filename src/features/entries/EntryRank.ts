import { type Converter } from '@a11d/converter'
import { Type } from '../../infrastructure/model/orm.js'

/**
 * An entry's position in the manual order. There is always room for a rank between any two, so
 * placing one entry never moves the others. Ranks compare by their keys' code units, never with
 * localeCompare. (Greenspan's fractional indexing.)
 */
export class EntryRank {
	private static readonly digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
	private static readonly smallest = 'A' + '0'.repeat(26)

	static readonly first = new EntryRank('a0')

	static parse(key: string): EntryRank {
		const rank = new EntryRank(key)
		if (key === EntryRank.smallest || rank.fraction.endsWith('0')) {
			throw new RangeError(`Malformed rank: '${key}'`)
		}
		return rank
	}

	/** Throws a RangeError when `previous` is not before `next`. */
	static between(previous: EntryRank | undefined, next: EntryRank | undefined): EntryRank {
		if (previous && next && !previous.isBefore(next)) {
			throw new RangeError(`Rank '${previous.key}' is not before '${next.key}'`)
		}
		if (!previous || !next) {
			return previous?.after() ?? next?.before() ?? EntryRank.first
		}
		if (previous.integer === next.integer) {
			return new EntryRank(previous.integer + EntryRank.midpoint(previous.fraction, next.fraction))
		}
		const following = EntryRank.increment(previous.integer)
		return following !== undefined && following < next.key
			? new EntryRank(following)
			: new EntryRank(previous.integer + EntryRank.midpoint(previous.fraction, ''))
	}

	/** The rank two neighbors decide, or undefined when they cannot: a neighbor without a rank (null), or
	 * two out of order. A missing neighbor (undefined) leaves that side open. */
	static tryBetween(previous: EntryRank | null | undefined, next: EntryRank | null | undefined): EntryRank | undefined {
		return previous === null || next === null || (previous && next && !previous.isBefore(next))
			? undefined
			: EntryRank.between(previous, next)
	}

	/** Consecutive ranks from the first, for a list ranked afresh. */
	static sequence(count: number): Array<EntryRank> {
		const ranks = new Array<EntryRank>()
		for (let rank = EntryRank.first; ranks.length < count; rank = rank.after()) {
			ranks.push(rank)
		}
		return ranks
	}

	/** Ascending, with unranked entries last. */
	static compare(a: EntryRank | null | undefined, b: EntryRank | null | undefined): number {
		return a && b ? a.compare(b) : Number(!a) - Number(!b)
	}

	private constructor(readonly key: string) {
		this.integer = EntryRank.integerOf(key)
	}

	/** The head encodes the integer part's length: 'a'..'z' positive, 'Z'..'A' negative, growing outward. */
	private readonly integer: string

	private get fraction() {
		return this.key.slice(this.integer.length)
	}

	/** The rank right after this one, counting the integer part up rather than growing a fraction. */
	after(): EntryRank {
		const following = EntryRank.increment(this.integer)
		return new EntryRank(following ?? this.integer + EntryRank.midpoint(this.fraction, ''))
	}

	before(): EntryRank {
		if (this.integer === EntryRank.smallest) {
			return new EntryRank(this.integer + EntryRank.midpoint('', this.fraction))
		}
		return new EntryRank(this.integer < this.key ? this.integer : EntryRank.decrement(this.integer))
	}

	compare(other: EntryRank) {
		return this.key < other.key ? -1 : this.key > other.key ? 1 : 0
	}

	isBefore(other: EntryRank) {
		return this.key < other.key
	}

	toString() {
		return this.key
	}

	static readonly converter: Converter<string | null | undefined, EntryRank | null | undefined> = {
		construct: key => key === null || key === undefined ? key : EntryRank.parse(key),
		deconstruct: rank => rank === null || rank === undefined ? rank : rank.key,
	}

	static readonly Mapper = class extends Type<EntryRank | null, string | null> {
		override convertToDatabaseValue(value: EntryRank | string | null | undefined): string | null {
			return value === null || value === undefined ? null : typeof value === 'string' ? EntryRank.parse(value).key : value.key
		}

		override convertToJSValue(value: EntryRank | string | null | undefined): EntryRank | null {
			return value === null || value === undefined ? null : typeof value === 'string' ? EntryRank.parse(value) : value
		}

		override getColumnType(): string {
			return 'text'
		}
	}

	private static integerOf(key: string): string {
		const head = key[0] ?? ''
		const length
			= head >= 'a' && head <= 'z' ? head.charCodeAt(0) - 'a'.charCodeAt(0) + 2
				: head >= 'A' && head <= 'Z' ? 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2
					: undefined
		if (length === undefined || length > key.length) {
			throw new RangeError(`Malformed rank: '${key}'`)
		}
		return key.slice(0, length)
	}

	/** A fraction strictly between `a` and `b`, where '' is 0 as the lower bound and 1 as the upper. */
	private static midpoint(a: string, b: string): string {
		if (b !== '') {
			let n = 0
			while ((a[n] ?? '0') === b[n]) {
				n++
			}
			if (n > 0) {
				return b.slice(0, n) + EntryRank.midpoint(a.slice(n), b.slice(n))
			}
		}
		const digitA = a === '' ? 0 : EntryRank.digits.indexOf(a[0]!)
		const digitB = b === '' ? EntryRank.digits.length : EntryRank.digits.indexOf(b[0]!)
		if (digitB - digitA > 1) {
			return EntryRank.digits[Math.round((digitA + digitB) / 2)]!
		}
		// Consecutive leading digits: a truncated `b` already lands between, else recurse past `a`'s head.
		return b.length > 1 ? b.slice(0, 1) : EntryRank.digits[digitA]! + EntryRank.midpoint(a.slice(1), '')
	}

	/** The next integer, or undefined past the largest ('z' followed by 26 'z's). */
	private static increment(integer: string): string | undefined {
		const head = integer[0]!
		const rest = [...integer.slice(1)]
		for (let i = rest.length - 1; i >= 0; i--) {
			const digit = EntryRank.digits.indexOf(rest[i]!) + 1
			if (digit < EntryRank.digits.length) {
				rest[i] = EntryRank.digits[digit]!
				return head + rest.join('')
			}
			rest[i] = '0'
		}
		if (head === 'Z') {
			return 'a0'
		}
		if (head === 'z') {
			return undefined
		}
		const next = String.fromCharCode(head.charCodeAt(0) + 1)
		return next > 'a' ? next + rest.join('') + '0' : next + rest.join('').slice(1)
	}

	private static decrement(integer: string): string {
		const head = integer[0]!
		const rest = [...integer.slice(1)]
		for (let i = rest.length - 1; i >= 0; i--) {
			const digit = EntryRank.digits.indexOf(rest[i]!) - 1
			if (digit >= 0) {
				rest[i] = EntryRank.digits[digit]!
				return head + rest.join('')
			}
			rest[i] = 'z'
		}
		if (head === 'a') {
			return 'Zz'
		}
		if (head === 'A') {
			throw new RangeError('No rank comes before the smallest one')
		}
		const next = String.fromCharCode(head.charCodeAt(0) - 1)
		return next < 'Z' ? next + rest.join('') + 'z' : next + rest.join('').slice(1)
	}
}
