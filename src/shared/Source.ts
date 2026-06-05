import { model } from './model.js'
import { entity, primaryKey, property, enum as enumType, manyToOne } from './orm.js'
import { Integration } from './Integration.js'

export enum SourceType {
	Event = 'event',
	Task = 'task',
}

@model('Source')
@entity()
export class Source {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => Integration, { mapToPk: true, deleteRule: 'cascade' }) integrationId!: string

	@property({ type: 'string' }) uri!: string

	@enumType(() => SourceType) type!: SourceType

	@property({ type: 'string' }) name!: string
	@property({ type: 'string', nullable: true }) color?: string
	@property({ type: 'boolean' }) hidden = false
	@property({ type: 'boolean' }) enabled = false

	@property({ type: 'json', nullable: true }) syncState?: Record<string, any>

	get key() {
		return `${this.type}#${this.uri}`
	}

	toggleEnabled() {
		this.enabled = !this.enabled
	}

	constructor(init?: Partial<Source>) {
		Object.assign(this, init)
	}

	toString() {
		return `${this.type} source "${this.name}"`
	}
}
