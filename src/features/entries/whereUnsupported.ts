import { createMetadataDecorator } from '@a11d/metadata'
import type { Source } from '#features/sources'
import type { OwnedField } from '#integrations'
import { ValidationError } from '#infrastructure/validation'
import type { Entry } from './Entry.js'

/** A save into a calendar that does not support the field: throws this error, or drops the field. */
export type UnsupportedSave = { readonly throw: string } | 'drop'

/** A move into a calendar that does not support the field: blocks the entry, which stays where it is, or drops the field. */
export type UnsupportedMove = 'block' | 'drop'

interface Unsupported {
	readonly save: UnsupportedSave
	/** None where a move does not judge the field. */
	readonly move?: UnsupportedMove
	/** Whether an entry has anything of the field that counts; without, whether the field holds a value. */
	readonly when?: (entry: Entry) => boolean
}

/** A field of an entry, and what a calendar that does not support it does with an entry carrying it. */
export class UnsupportedField {
	constructor(readonly name: OwnedField, private readonly unsupported: Unsupported) { }

	get move() { return this.unsupported.move }

	/** What a save carrying it into a calendar that does not support it throws, if it throws. */
	get error() {
		const { save } = this.unsupported
		return save === 'drop' ? undefined : new ValidationError(save.throw, [this.name])
	}

	/** Whether `entry` has something of it that `target` does not support. */
	unsupportedIn(target: Source, entry: Entry) {
		return !target.ownership.holds(this.name) && (this.unsupported.when?.(entry) ?? UnsupportedField.holdsValue((entry as unknown as Record<string, unknown>)[this.name]))
	}

	private static holdsValue(value: unknown) {
		if (value === undefined || value === null || value === false || value === '') {
			return false
		}
		return typeof value !== 'object' || !('length' in value) || (value as { readonly length: number }).length > 0
	}
}

const declared = createMetadataDecorator('whereUnsupported')

/** Declares what a calendar that does not support the field does with an entry carrying it, on a save and on a move. */
export function whereUnsupported(unsupported: Unsupported) {
	return declared(unsupported)
}

/** The field `name` of `type`, as it declares it. */
whereUnsupported.fieldOf = (type: Constructor<object>, name: OwnedField) =>
	new UnsupportedField(name, declared.get(type, name) as Unsupported)

/** The fields `type` declares, a base class's first, each in the order it is declared. */
whereUnsupported.fieldsOf = (type: Constructor<object>) =>
	[...declared.keys(type)].map(name => whereUnsupported.fieldOf(type, name as OwnedField))
