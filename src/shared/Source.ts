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
	/** The provider's own name for this source as of the last reconcile — NOT what's shown (`name`
	 * is). It lets {@link Integration.getSources} tell a REMOTE rename (the provider's name changed)
	 * apart from a LOCAL one (the user renamed via PUT /sources/:id/name), so a user's custom name
	 * survives a background sync instead of being reset to the provider's every cycle. Null for a
	 * source never reconciled against a provider (e.g. a local-only Dev source). */
	@property({ type: 'string', nullable: true }) remoteName?: string | null
	@property({ type: 'string', nullable: true }) color?: string
	@property({ type: 'boolean' }) hidden = false
	@property({ type: 'boolean' }) enabled = false
	/** Manual sidebar position among the integration's sources (see PUT /sources/order and
	 * shared/order.ts). Sorted `asc nulls last`: null means "never placed by hand" — after every
	 * numbered row, in discovery order — so a newly found, newly enabled or re-appearing source
	 * appends at the end instead of reshuffling a hand-ordered list. */
	@property({ type: 'number', nullable: true }) order?: number | null

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
