import { type EntityManager } from '@mikro-orm/sqlite'
import { model } from '../../infrastructure/model/model.js'
import { Integration, integration } from '../Integration.js'
import { type Source } from '../../features/sources/Source.js'

/**
 * Local SQLite-backed integration with no external remote sync.
 * Directly manages sources and entries in database.
 */
@model('MitraCalendar')
@integration('mitra')
export class MitraCalendar extends Integration {
	static readonly label: string = 'Mitra'
	static readonly logo: string = 'mitra'
	static readonly description: string = 'Calendars stored in Mitra itself, no account needed'
	static override readonly onePerUser: boolean = true
	static override readonly discoversSources: boolean = false

	/** Constant, so the `(userId, uri)` index enforces `onePerUser`. */
	static readonly uri: string = 'mitra://local'

	static sourceUri(id: string) {
		return `mitra://calendar/${id}`
	}

	constructor(init?: Partial<MitraCalendar>) {
		super()
		this.uri = (new.target as typeof MitraCalendar).uri
		Object.assign(this, init)
	}

	override toString() {
		return `${(this.constructor as typeof MitraCalendar).label} integration ${this.id}`
	}

	override merge(_incoming: this) { }

	override get canConnect() { return true }

	override get syncInterval() { return Infinity }

	/** No participants: there is no server to deliver invitations. */
	override get capabilities() {
		return { ...Integration.defaultCapabilities, participants: false, createSources: true, deleteSources: true }
	}

	/** Identity pass preserving existing database sources during reconciliation. */
	protected override fetchSources(existing?: ReadonlyArray<Source>): Promise<Array<Source>> {
		return Promise.resolve([...existing ?? []])
	}

	protected override syncSourceEntries(): Promise<boolean> {
		return Promise.resolve(false)
	}

	override get reimportable() { return false }

	override reimportSource(_em: EntityManager, _source: Source): Promise<void> {
		return Promise.resolve()
	}

	/** Every entry lives in the database: there is no provider. */
	override storesLocally() { return true }

	override createSource(em: EntityManager, source: Source): Promise<Source> {
		source.integrationId = this.id
		source.uri ||= MitraCalendar.sourceUri(source.id)
		// Nothing to import, so never show it as importing.
		source.markImported()
		em.persist(source)
		return Promise.resolve(source)
	}

	override deleteSource(em: EntityManager, source: Source): Promise<void> {
		em.remove(source)
		return Promise.resolve()
	}
}
