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

	get collectionUri() {
		return this.uri.endsWith('/') ? this.uri : `${this.uri}/`
	}

	normalizeUri(uri: string | null | undefined): string {
		if (!uri) return ''
		try {
			return new URL(uri, this.collectionUri).href
		} catch {
			return uri
		}
	}

	matchesUri(uri1: string | null | undefined, uri2: string | null | undefined): boolean {
		if (!uri1 || !uri2) return false
		return this.normalizeUri(uri1) === this.normalizeUri(uri2)
	}

	constructor(init?: Partial<Source>) {
		Object.assign(this, init)
	}

	toString() {
		return `${this.type} source "${this.name}"`
	}
}
