import { z } from 'zod'
import { type Converter } from '@a11d/converter'
import { Type } from '#infrastructure/model'

export type TransparencyCode = 'busy' | 'free'

/** Whether an entry takes up its time, RFC 5545's TRANSP. One instance each, so they compare by identity. */
export class Transparency {
	static readonly Busy = new Transparency('busy')
	static readonly Free = new Transparency('free')

	static readonly all: ReadonlyArray<Transparency> = [Transparency.Busy, Transparency.Free]

	/** A transparency from its code, or undefined for anything else. */
	static parse(value: unknown): Transparency | undefined {
		return value instanceof Transparency ? value : Transparency.all.find(transparency => transparency.code === value)
	}

	private constructor(readonly code: TransparencyCode) { }

	format() {
		switch (this.code) {
			case 'busy': return t('Busy')
			case 'free': return t('Free')
		}
	}

	toString() {
		return this.code
	}

	static readonly converter: Converter<TransparencyCode | null | undefined, Transparency | null | undefined> = {
		schema: z.enum(Transparency.all.map(transparency => transparency.code)),
		construct: value => value === null ? value : Transparency.parse(value),
		deconstruct: value => value?.code ?? value as null | undefined,
	}

	/** Declared through `@enum` with the codes as its items, so the column keeps its CHECK constraint. */
	static readonly Mapper = class extends Type<Transparency | null, string | null> {
		override convertToDatabaseValue(value: Transparency | string | null | undefined) {
			return Transparency.parse(value)?.code ?? null
		}

		override convertToJSValue(value: Transparency | string | null | undefined) {
			return Transparency.parse(value) ?? null
		}

		override getColumnType() {
			return 'text'
		}
	}
}
