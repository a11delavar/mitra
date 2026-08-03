import { model } from './model.js'
import { entity, primaryKey, property, manyToOne } from './orm.js'
import { Integration } from './Integration.js'
import { EntryType, EntryTypesMapper, type EntryTypeValue } from './EntryType.js'

@model('Source')
@entity()
export class Source {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => Integration, { mapToPk: true, deleteRule: 'cascade' }) integrationId!: string

	@property({ type: 'string' }) uri!: string

	// NULLABLE for one reason: `orm.schema.update()` adds this column to an existing database, where
	// every row already exists — a NOT NULL column with no default fails that ALTER outright and the
	// server never boots (verified). A pre-column row therefore reads as the empty list, which is the
	// same "the provider never said" the RFC's absent component set means, and the next reconcile fills
	// it in from the provider.
	@property({ type: EntryTypesMapper, fieldName: 'entry_types', nullable: true }) private _entryTypes?: Array<EntryType> | null = [EntryType.Event, EntryType.Task]
	/** The entry types this source can hold — the provider's own answer, discovered per source rather
	 * than hardcoded per integration: a CalDAV collection declares its `supported-calendar-component-set`
	 * (a VEVENT-only work calendar must not offer tasks), Notion views hold tasks only. A source is NOT
	 * a type — one collection is one row, whatever it can carry; the type of a given entry lives on
	 * {@link Entry.type}, where it is authoritative. Per RFC 4791 §5.2.3 an absent/empty component set
	 * means "accepts everything", which is also how {@link supportsEntryType} reads an empty list. */
	get entryTypes(): ReadonlyArray<EntryType> {
		return this._entryTypes ?? []
	}
	/** Accepts the wire form too, which is what carries the value objects across the API: the frontend's
	 * reviver assigns the raw `["event","task"]` off the JSON here (see {@link EntryType.parse}). */
	set entryTypes(value: ReadonlyArray<EntryType | EntryTypeValue> | undefined | null) {
		this._entryTypes = (value ?? []).map(type => EntryType.parse(type))
	}

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

	/** Whether an entry of this type can live here. Tolerant of a missing/empty list — an unknown
	 * component set accepts everything (RFC 4791 §5.2.3), which is also the right reading for a row
	 * written before this column existed. */
	supportsEntryType(type: EntryType): boolean {
		return !this.entryTypes?.length || this.entryTypes.includes(type)
	}

	/** The type a new entry takes here. Mitra is calendar-first, so an event wherever the source can
	 * hold one; a source that cannot (a Notion task view) makes its own type instead. What the create
	 * gestures, the palette's Create Entry and a cross-source migration all default to. */
	get defaultEntryType(): EntryType {
		return this.supportsEntryType(EntryType.Event) ? EntryType.Event : this.entryTypes[0] ?? EntryType.Event
	}

	/** The identity of a source within its integration: its collection URL, and nothing else — one
	 * collection is one source. A static so it works on a plain DTO too: an incoming request body
	 * arrives structure-cloned by `@a11d/api` (no class, so no `key` getter), and `applyAndSync` must
	 * still match those against managed rows. */
	static keyOf(source: { uri: string }): string {
		return source.uri
	}

	get key() {
		return Source.keyOf(this)
	}

	/** The wire shape — the accessor pair re-exposed under its own name as plain values, for the same
	 * reasons as `Entry.toJSON` (a spread sees only the backing field, and a structure-cloned request
	 * body keeps strings but not class instances). */
	toJSON() {
		// Through the getter, so a pre-column row sends the empty list rather than dropping the key — the
		// client then reads the same "unknown, accept everything" the server does.
		return { ...this as Source, _entryTypes: undefined, entryTypes: this.entryTypes.map(type => type.value) }
	}

	toggleEnabled() {
		this.enabled = !this.enabled
	}

	constructor(init?: Partial<Source>) {
		Object.assign(this, init)
	}

	toString() {
		return `source "${this.name}"`
	}
}
