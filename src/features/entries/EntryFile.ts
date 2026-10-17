import { converter } from '@a11d/converter'
import { entity, property, manyToOne, unique, enum as enumType } from '../../infrastructure/model/orm.js'
import { equality } from '../../infrastructure/model/Entity.js'
import { File } from '../files/File.js'
import { Entry } from './Entry.js'
import { EntryFileType } from './EntryFileType.js'

/** A file an entry carries, as what (`type`) and in which place among the entry's files of that type (`rank`): each once per type, by hash or by URL. */
@entity()
@unique({ properties: ['entry', 'type', 'sha256'] })
@unique({ properties: ['entry', 'type', 'sourceUrl'] })
export class EntryFile extends File {
	@converter({ out: {} })
	@manyToOne(() => Entry, { deleteRule: 'cascade', fieldName: 'entry_id' }) entry!: Entry

	@equality()
	@converter(EntryFileType.converter)
	@enumType({ type: EntryFileType.Mapper, items: EntryFileType.all.map(String) }) type!: EntryFileType

	/** Its place among the entry's files of its type, which the list's order states on the wire. */
	@equality()
	@converter({ out: {} })
	@property({ type: 'number' }) rank = 0

	// After `super()`: the field initializers above run once it returns and would reset what `init` gave.
	constructor(init?: Partial<EntryFile>) {
		super()
		Object.assign(this, init)
	}

	/** This file as what it is to the entry, in its place among those: a clone, as the one given may be another entry's row or a list's. */
	as(type: EntryFileType, rank: number) {
		return Object.assign(this.clone(), { type, rank })
	}

	/** Whether this, as a reference, names `file` as the same thing to the entry: a type, where both name one, agrees. */
	override refersTo(file: File) {
		return super.refersTo(file) && (!(file instanceof EntryFile) || !file.type || !this.type || file.type === this.type)
	}
}
