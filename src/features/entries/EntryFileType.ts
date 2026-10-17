import { type Converter } from '@a11d/converter'
import { Type } from '../../infrastructure/model/orm.js'

export type EntryFileTypeCode = 'attachment'

/** What a file is to the entry carrying it: one of its attachments (RFC 5545 `ATTACH`). One instance per type, so they compare by identity. */
export class EntryFileType {
	static readonly Attachment = new EntryFileType('attachment')

	static readonly all: ReadonlyArray<EntryFileType> = [EntryFileType.Attachment]

	static parse(value: unknown): EntryFileType | undefined {
		return value instanceof EntryFileType ? value : EntryFileType.all.find(type => type.code === value)
	}

	private constructor(readonly code: EntryFileTypeCode) { }

	toString() {
		return this.code
	}

	static readonly converter: Converter<EntryFileTypeCode | undefined, EntryFileType | undefined> = {
		construct: value => EntryFileType.parse(value),
		deconstruct: value => value?.code,
	}

	/** Declared through `@enum` with the codes as its items, so the column keeps its CHECK constraint. */
	static readonly Mapper = class extends Type<EntryFileType, string> {
		override convertToDatabaseValue(value: EntryFileType | string) {
			return EntryFileType.parse(value)!.code
		}

		override convertToJSValue(value: EntryFileType | string) {
			return EntryFileType.parse(value)!
		}

		override getColumnType() {
			return 'text'
		}
	}
}
