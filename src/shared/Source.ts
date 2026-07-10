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

	get visible() {
		return this.enabled && !this.hidden
	}

	@property({ type: 'json', nullable: true }) syncState?: Record<string, any>

	/** The identity of a source within its integration: its component type + collection URL. A static
	 * so it works on a plain DTO too — an incoming request body arrives structure-cloned by `@a11d/api`
	 * (no class, so no `key` getter), and `applyAndSync` must still match those against managed rows. */
	static keyOf(source: { type: SourceType | string, uri: string }): string {
		return `${source.type}#${source.uri}`
	}

	get key() {
		return Source.keyOf(this)
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
