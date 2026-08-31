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

	/** The entry types this source can hold (RFC 4791 §5.2.3: empty accepts everything). */
	@property({ type: EntryTypes.Mapper, fieldName: 'entry_types', nullable: true })
	@converter(EntryTypes.converter)
	entryTypes: EntryTypes = EntryTypes.of(EntryType.Event, EntryType.Task)

	@property({ type: 'string' }) name!: string
	/** Provider's baseline name for this source to differentiate local vs remote renames during reconcile. */
	@property({ type: 'string', nullable: true }) remoteName?: string | null
	@property({ type: 'string', nullable: true }) color?: string
	@property({ type: 'boolean', fieldName: 'read_only', nullable: true }) readOnly?: boolean | null
	@property({ type: 'boolean' }) hidden = false
	@property({ type: 'boolean' }) enabled = false
	/** Manual sidebar display order among the integration's sources (sorted asc nulls last). */
	@property({ type: 'number', nullable: true }) order?: number | null

	get visible() {
		return this.enabled && !this.hidden
	}

	/** Timestamp when source finished initial import (null while importing). */
	@property({ type: 'datetime', nullable: true }) importedAt?: Date | null

	get importing() {
		return this.enabled && !this.importedAt
	}

	/** Resets import timestamp and sync state for full re-import. */
	awaitImport() {
		this.importedAt = null
		this.syncState = undefined
	}

	/** Records successful full import. Returns true if this ended an active import. */
	markImported(): boolean {
		if (this.importedAt) {
			return false
		}
		this.importedAt = new Date()
		return true
	}

	@property({ type: 'json', nullable: true }) syncState?: Record<string, any>

	supportsEntryType(type: EntryType): boolean {
		return !this.entryTypes?.length || this.entryTypes.includes(type)
	}

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
