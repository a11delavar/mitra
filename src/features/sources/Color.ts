import { z } from 'zod'
import { type Converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { Type } from '#infrastructure/model'
import { ValidationError } from '#infrastructure/validation'
import { cssColorNames } from './cssColorNames.js'

/** Hex or a color's name, as CalDAV's calendar-color and RFC 7986's COLOR write one: nothing else, as it is written into styles. */
const grammar = /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]+)$/

/** A calendar's or an entry's color, lowercase. One instance per color, so they compare by identity. */
export class Color {
	private static readonly known = new Map<string, Color>()
	private static readonly presetsByName = new Map<string, Color>()

	static readonly Red = Color.preset('#eb5a5a', 'firebrick', ['red', 'indianred', 'tomato'])
	static readonly Orange = Color.preset('#e9967a', 'darksalmon', ['orange', 'coral'])
	static readonly Yellow = Color.preset('#f9c344', 'gold', ['yellow'])
	static readonly Lime = Color.preset('#b5cf55', 'yellowgreen', ['lime'])
	static readonly Green = Color.preset('#63d18d', 'mediumseagreen', ['green'])
	static readonly Blue = Color.preset('#51ace3', 'steelblue', ['blue', 'deepskyblue'])
	static readonly Purple = Color.preset('#9b61f9', 'rebeccapurple', ['purple', 'mediumpurple'])
	static readonly Pink = Color.preset('#e887b6', 'palevioletred', ['pink', 'lightpink', 'hotpink'])
	static readonly Grey = Color.preset('#b4b4b4', 'darkgray', ['gray', 'grey'])

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

	/** A preset writes a CSS name of its own and reads it, and the plain names it stands for, back as itself: by distance, `orange` would land on yellow and `pink` on grey. */
	private static preset(hex: string, name: string, aliases: ReadonlyArray<string>) {
		const color = Color.parse(hex)!
		color.nearestName = name
		for (const alias of [name, ...aliases]) {
			Color.presetsByName.set(alias, color)
		}
		return color
	}

	/** The color a CSS name or hex written by another calendar app stands for, a preset where it names one. */
	static fromCss(value: string): Color | undefined {
		const text = value.trim().toLowerCase()
		return Color.presetsByName.get(text) ?? Color.parse(text)
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

	private nearestName?: string

	/** A hex no preset stands for, which a CSS name only approximates. */
	get exact() {
		return this.value.startsWith('#') && !Color.palette.includes(this)
	}

	/** The CSS name it is written as where only one may be (RFC 7986's COLOR): a preset's own, else the nearest in OKLab. */
	get cssName() {
		if (!this.value.startsWith('#')) {
			return this.value
		}
		if (this.nearestName === undefined) {
			const lab = Color.oklabOf(this.value)
			let nearest = { name: 'black', distance: Infinity }
			for (const [name, hex] of Object.entries(cssColorNames)) {
				const distance = Math.hypot(...Color.oklabOf(hex).map((value, i) => value - lab[i]!))
				if (distance < nearest.distance) {
					nearest = { name, distance }
				}
			}
			this.nearestName = nearest.name
		}
		return this.nearestName
	}

	/** Whether a COLOR value spells the name it is written as, by the color behind the names (`aqua` is `cyan`). */
	isWrittenAs(value: string) {
		const hexOf = (text: string) => cssColorNames[text] ?? text
		return hexOf(this.cssName) === hexOf(value.trim().toLowerCase())
	}

	private static oklabOf(hex: string) {
		const digits = hex.length <= 5 ? [...hex.slice(1, 4)].map(digit => digit + digit).join('') : hex.slice(1, 7)
		const [r, g, b] = [0, 2, 4].map(i => {
			const channel = parseInt(digits.slice(i, i + 2), 16) / 255
			return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
		}) as [number, number, number]
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
		const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
		return [
			0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
			1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
			0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
		]
	}

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
