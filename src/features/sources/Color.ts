import { z } from 'zod'
import { type Converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { Type } from '#infrastructure/model'
import { ValidationError } from '#infrastructure/validation'

/** Hex or a color's name, as CalDAV's calendar-color and RFC 7986's COLOR write one: nothing else, as it is written into styles. */
const grammar = /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]+)$/

/** A calendar's or an entry's color, lowercase. One instance per color, so they compare by identity. */
export class Color {
	private static readonly known = new Map<string, Color>()

	static readonly Red = Color.parse('#eb5a5a')!
	static readonly Orange = Color.parse('#e58b4b')!
	static readonly Yellow = Color.parse('#f9c344')!
	static readonly Lime = Color.parse('#b5cf55')!
	static readonly Green = Color.parse('#63d18d')!
	static readonly Blue = Color.parse('#51ace3')!
	static readonly Purple = Color.parse('#9b61f9')!
	static readonly Pink = Color.parse('#e887b6')!
	static readonly Grey = Color.parse('#b4b4b4')!

	static readonly palette: ReadonlyArray<Color> = [
		Color.Red,
		Color.Orange,
		Color.Yellow,
		Color.Lime,
		Color.Green,
		Color.Blue,
		Color.Purple,
		Color.Pink,
		Color.Grey,
	]

	/** The color a value names; none when it names none. */
	static parse(value: unknown): Color | undefined {
		if (value instanceof Color) {
			return value
		}
		const text = typeof value === 'string' ? value.trim().toLowerCase() : undefined
		if (!text || !grammar.test(text)) {
			return undefined
		}
		let color = Color.known.get(text)
		if (!color) {
			color = new Color(text)
			Color.known.set(text, color)
		}
		return color
	}

	/** The preset an identifier always lands on, for what brings no color of its own. */
	static derivedFrom(identifier: string): Color {
		let hash = 0
		for (let i = 0; i < identifier.length; i++) {
			hash = identifier.charCodeAt(i) + ((hash << 5) - hash)
		}
		return Color.palette[Math.abs(hash) % Color.palette.length]!
	}

	/** The first preset none of `taken` uses, starting at green, so each new calendar gets its own. */
	static unusedAmong(taken: Iterable<Color | undefined>): Color {
		const used = new Set(taken)
		const start = Color.palette.indexOf(Color.Green)
		const rotation = [...Color.palette.slice(start), ...Color.palette.slice(0, start)]
		return rotation.find(color => !used.has(color)) ?? rotation[used.size % rotation.length]!
	}

	private constructor(readonly value: string) { }

	toString() {
		return this.value
	}

	[equals](other: unknown) {
		return other === this
	}

	static readonly converter: Converter<string | null | undefined, Color | null | undefined> = {
		schema: z.string(),
		construct: value => {
			if (value === null || value === undefined) {
				return value
			}
			const color = Color.parse(value)
			if (!color) {
				throw new ValidationError(`"${value}" is not a color. Write it in hex (#3366cc) or by its CSS name.`, ['color'])
			}
			return color
		},
		deconstruct: value => value?.value ?? value as null | undefined,
	}

	static readonly Mapper = class extends Type<Color | null, string | null> {
		override convertToDatabaseValue(value: Color | string | null | undefined) {
			return Color.parse(value)?.value ?? null
		}

		override convertToJSValue(value: Color | string | null | undefined) {
			return Color.parse(value) ?? null
		}

		override getColumnType() {
			return 'text'
		}
	}
}
