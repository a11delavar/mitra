import { model } from './model.js'
import { entity, primaryKey, property, manyToOne, oneToMany, cascade } from './orm.js'
import { Collection } from './orm.js'
import { Integration } from './Integration.js'
import { Entry } from './Entry.js'

export enum SourceType {
	Calendar = 'calendar',
	Tasks = 'tasks',
}

@model('Source')
@entity()
export class Source {
	@primaryKey() id = crypto.randomUUID()
	@manyToOne(() => Integration) integration!: Integration
	@property({ type: 'string' }) externalId!: string
	@property({ type: 'string', nullable: true }) url?: string
	@property({ type: 'string' }) type!: SourceType
	@property({ type: 'string' }) name!: string
	@property({ type: 'string', nullable: true }) color?: string
	@property({ type: 'boolean' }) hidden = false
	@property({ type: 'boolean' }) enabled = false
	@property({ type: 'string', nullable: true }) syncToken?: string
	@property({ type: 'string', nullable: true }) ctag?: string
	@oneToMany(() => Entry, entry => entry.source, { cascade: [cascade.ALL], orphanRemoval: true }) entries = new Collection<Entry>(this)

	constructor(init?: Partial<Source>) {
		Object.assign(this, init)
	}

	toString() {
		return `${this.type} source "${this.name}"`
	}
}
