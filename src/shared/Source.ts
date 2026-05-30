import { model } from './model.js'
import { entity, primaryKey, property, manyToOne } from './orm.js'
import { Integration } from './Integration.js'

export enum SourceType {
	Calendar = 'calendar',
	Tasks = 'tasks',
}

@model('Source')
@entity()
export class Source {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => Integration, { mapToPk: true, deleteRule: 'cascade' }) integrationId!: string

	@property({ type: 'string' }) externalId!: string
	@property({ type: 'string', nullable: true }) url?: string
	@property({ type: 'string' }) type!: SourceType
	@property({ type: 'string' }) name!: string
	@property({ type: 'string', nullable: true }) color?: string
	@property({ type: 'boolean' }) hidden = false
	@property({ type: 'boolean' }) enabled = false
	@property({ type: 'string', nullable: true }) syncToken?: string
	@property({ type: 'string', nullable: true }) ctag?: string

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
