import { type Converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import { Type } from '#infrastructure/model'

const grammar = /^([a-z0-9][a-z0-9!#$&^_.+-]*)\/([a-z0-9][a-z0-9!#$&^_.+-]*)$/

/** The families a browser shows in place without running anything of theirs. SVG is left out: it scripts the app's origin. */
const shownInPlace = (type: MimeType) =>
	(type.type === 'image' && type.subtype !== 'svg+xml') || type.type === 'video' || type.type === 'audio' || type.value === 'application/pdf' || type.value === 'text/plain'

/** A media type (RFC 6838), as a `Content-Type` or an `FMTTYPE` names one: lowercase, without parameters. One instance per type, so they compare by identity. */
export class MimeType {
	private static readonly known = new Map<string, MimeType>()

	static readonly octetStream = MimeType.parse('application/octet-stream')!

	/** The type a header or parameter names, its parameters dropped; none when malformed. */
	static parse(value: unknown): MimeType | undefined {
		if (value instanceof MimeType) {
			return value
		}
		const match = typeof value === 'string' ? grammar.exec(value.split(';')[0]!.trim().toLowerCase()) : undefined
		if (!match) {
			return undefined
		}
		let type = MimeType.known.get(match[0])
		if (!type) {
			type = new MimeType(match[1]!, match[2]!)
			MimeType.known.set(match[0], type)
		}
		return type
	}

	private constructor(readonly type: string, readonly subtype: string) { }

	get value() {
		return `${this.type}/${this.subtype}`
	}

	/** Whether a browser may show it in place; everything else is downloaded. */
	get inline() {
		return shownInPlace(this)
	}

	/** Its glyph, by family. */
	get icon() {
		return this.type === 'image' ? 'image'
			: this.type === 'video' ? 'film'
				: this.type === 'audio' ? 'music'
					: this.value === 'application/pdf' || this.type === 'text' ? 'file-text'
						: 'file'
	}

	toString() {
		return this.value
	}

	[equals](other: unknown) {
		return other === this
	}

	static readonly converter: Converter<string | undefined, MimeType | undefined> = {
		construct: value => MimeType.parse(value),
		deconstruct: value => value?.value,
	}

	static readonly Mapper = class extends Type<MimeType | null, string | null> {
		override convertToDatabaseValue(value: MimeType | string | null) {
			return value === null ? null : MimeType.parse(value)?.value ?? null
		}

		override convertToJSValue(value: MimeType | string | null) {
			return value === null ? null : MimeType.parse(value) ?? null
		}

		override getColumnType() {
			return 'text'
		}
	}
}
