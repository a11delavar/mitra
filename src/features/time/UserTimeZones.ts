import { type Converter } from '@a11d/converter'
import { Type } from '#infrastructure/model'
import { TimeZone } from './TimeZone.js'

/** A zone the user keeps, with their own name for it if they gave one ("Mom"). */
export interface UserTimeZone {
	readonly zone: TimeZone
	readonly label?: string
}

/**
 * The time zones a user keeps: home and the others they added. The device's zone anchors its grid and is never stored;
 * home is the first device's zone until `makeHome` replaces it, and is never removed.
 */
export class UserTimeZones {
	static readonly maximumLabelLength = 24

	static readonly none = new UserTimeZones(undefined, [])

	/** Skips ids that no longer name a zone. A plain array is the format from before home, read as all others. */
	static parse(stored: unknown): UserTimeZones {
		const record = Array.isArray(stored) ? { others: stored } : (stored ?? {}) as { home?: unknown, others?: unknown }
		const home = UserTimeZones.read(record.home)
		const others = (Array.isArray(record.others) ? record.others : []).map(UserTimeZones.read)
			.filter((zone, index, zones): zone is UserTimeZone => !!zone && !home?.zone.equals(zone.zone) && zones.findIndex(other => other?.zone.equals(zone.zone)) === index)
		return new UserTimeZones(home, others)
	}

	private static read(value: unknown): UserTimeZone | undefined {
		const { id, label } = (value ?? {}) as { id?: unknown, label?: unknown }
		const zone = TimeZone.parse(id)
		return !zone ? undefined : UserTimeZones.named(zone, typeof label === 'string' ? label : undefined)
	}

	private static named(zone: TimeZone, label?: string): UserTimeZone {
		const name = label?.trim().slice(0, UserTimeZones.maximumLabelLength)
		return name ? { zone, label: name } : { zone }
	}

	private constructor(readonly home: UserTimeZone | undefined, readonly others: ReadonlyArray<UserTimeZone>) { }

	/** Home first, then the others in the order they joined. */
	get zones(): ReadonlyArray<UserTimeZone> {
		return this.home ? [this.home, ...this.others] : this.others
	}

	find(zone: TimeZone) {
		return this.zones.find(kept => kept.zone.equals(zone))
	}

	has(zone: TimeZone) {
		return !!this.find(zone)
	}

	isHome(zone: TimeZone) {
		return !!this.home?.zone.equals(zone)
	}

	labelOf(zone: TimeZone) {
		return this.find(zone)?.label
	}

	headingOf(zone: TimeZone, locale?: Intl.Locale) {
		return this.labelOf(zone) || zone.name(locale).short
	}

	/** The columns beside the grid's anchor, the device's zone. */
	besides(here: TimeZone): ReadonlyArray<UserTimeZone> {
		return this.zones.filter(kept => !kept.zone.equals(here))
	}

	settle(here: TimeZone): UserTimeZones {
		return this.home ? this : this.makeHome(here)
	}

	add(zone: TimeZone): UserTimeZones {
		return this.has(zone) ? this : new UserTimeZones(this.home, [...this.others, { zone }])
	}

	/** Home stays: it is only replaced, through `makeHome`. */
	remove(zone: TimeZone): UserTimeZones {
		return new UserTimeZones(this.home, this.others.filter(kept => !kept.zone.equals(zone)))
	}

	/** Names a zone, which keeps it if it was only the device's. An empty name goes back to the automatic one. */
	rename(zone: TimeZone, label: string | undefined): UserTimeZones {
		const named = UserTimeZones.named(zone, label)
		return this.isHome(zone) ? new UserTimeZones(named, this.others)
			: this.has(zone) ? new UserTimeZones(this.home, this.others.map(kept => kept.zone.equals(zone) ? named : kept))
				: !named.label ? this
					: new UserTimeZones(this.home, [...this.others, named])
	}

	/** Keeps the zone's name; the old home takes the new one's place among the others. */
	makeHome(zone: TimeZone): UserTimeZones {
		if (this.isHome(zone)) {
			return this
		}
		const home = this.find(zone) ?? { zone }
		const index = this.others.indexOf(home)
		const others = this.others.filter(kept => kept !== home)
		if (this.home) {
			others.splice(index === -1 ? 0 : index, 0, this.home)
		}
		return new UserTimeZones(home, others)
	}

	toJSON() {
		const stored = ({ zone, label }: UserTimeZone) => label ? { id: zone.id, label } : { id: zone.id }
		return { ...(this.home ? { home: stored(this.home) } : {}), others: this.others.map(stored) }
	}

	static readonly converter: Converter<unknown, UserTimeZones | undefined> = {
		construct: value => UserTimeZones.parse(value),
		deconstruct: value => value?.toJSON() ?? null,
	}

	/** An account without zones leaves the column empty, which MikroORM hands over as null, unconverted, in both directions. */
	static readonly Mapper = class extends Type<UserTimeZones | undefined, string | null> {
		override convertToDatabaseValue(value: UserTimeZones | null | undefined): string | null {
			return value ? JSON.stringify(value.toJSON()) : null
		}

		override convertToJSValue(value: unknown): UserTimeZones {
			return UserTimeZones.parse(typeof value === 'string' ? JSON.parse(value) : value)
		}

		override getColumnType(): string {
			return 'json'
		}
	}
}
