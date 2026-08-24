import { converter } from '@a11d/converter'
import { model } from '../../infrastructure/model/model.js'
import { entity, primaryKey, property, manyToOne } from '../../infrastructure/model/orm.js'
import { Integration } from '../../integrations/Integration.js'
import { EntryType, EntryTypes } from '../entries/EntryType.js'

@model('Source')
@entity()
export class Source {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => Integration, { mapToPk: true, deleteRule: 'cascade' }) integrationId!: string

	@property({ type: 'string' }) uri!: string

	/** The entry types this source can hold — the provider's own answer, discovered per source rather
	 * than hardcoded per integration: a CalDAV collection declares its `supported-calendar-component-set`
	 * (a VEVENT-only work calendar must not offer tasks), Notion views hold tasks only. A source is NOT
	 * a type — one collection is one row, whatever it can carry; the type of a given entry lives on
	 * {@link Entry.type}, where it is authoritative. Per RFC 4791 §5.2.3 an absent/empty component set
	 * means "accepts everything", which is also how {@link supportsEntryType} reads an empty list.
	 *
	 * NULLABLE for one reason: `orm.schema.update()` adds this column to an existing database, where
	 * every row already exists — a NOT NULL column with no default fails that ALTER outright and the
	 * server never boots (verified). {@link EntryTypes.Mapper} reads such a row back as the empty list,
	 * which is the same "the provider never said" the RFC's absent component set means, and the next
	 * reconcile fills it in from the provider. */
	@property({ type: EntryTypes.Mapper, fieldName: 'entry_types', nullable: true })
	@converter(EntryTypes.converter)
	entryTypes: EntryTypes = EntryTypes.of(EntryType.Event, EntryType.Task)

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
	 * infrastructure/model/order.ts). Sorted `asc nulls last`: null means "never placed by hand" — after every
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
		return this.supportsEntryType(EntryType.Event) ? EntryType.Event : this.entryTypes?.[0] ?? EntryType.Event
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
