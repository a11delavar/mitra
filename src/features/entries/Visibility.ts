import { z } from 'zod'
import { type Converter } from '@a11d/converter'
import { Type } from '#infrastructure/model'

export type VisibilityCode = 'public' | 'private' | 'confidential'

/** Who may see an entry's details, RFC 5545's CLASS; none is the calendar's default. One instance each, so they compare by identity. */
export class Visibility {
	static readonly Public = new Visibility('public')
	static readonly Private = new Visibility('private')
	static readonly Confidential = new Visibility('confidential')

	static readonly all: ReadonlyArray<Visibility> = [Visibility.Public, Visibility.Private, Visibility.Confidential]

	/** A visibility from its code, or undefined for anything else. */
	static parse(value: unknown): Visibility | undefined {
		return value instanceof Visibility ? value : Visibility.all.find(visibility => visibility.code === value)
	}

	private constructor(readonly code: VisibilityCode) { }

	format() {
		switch (this.code) {
			case 'public': return t('Public')
			case 'private': return t('Private')
			case 'confidential': return t('Confidential')
		}
	}

	toString() {
		return this.code
	}

	static readonly converter: Converter<VisibilityCode | null | undefined, Visibility | null | undefined> = {
		schema: z.enum(Visibility.all.map(visibility => visibility.code)),
		construct: value => value === null ? value : Visibility.parse(value),
		deconstruct: value => value?.code ?? value as null | undefined,
	}

	/** Declared through `@enum` with the codes as its items, so the column keeps its CHECK constraint. */
	static readonly Mapper = class extends Type<Visibility | null, string | null> {
		override convertToDatabaseValue(value: Visibility | string | null | undefined) {
			return Visibility.parse(value)?.code ?? null
		}

		override convertToJSValue(value: Visibility | string | null | undefined) {
			return Visibility.parse(value) ?? null
		}

		override getColumnType() {
			return 'text'
		}
	}
}
