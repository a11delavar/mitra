import { entity, primaryKey, property, manyToOne, oneToMany, Collection } from './orm.js'
import { User } from './User.js'
import { Source } from './Source.js'
import type { Entry } from './Entry.js'
import type { EntityManager } from '@mikro-orm/core'

@entity({ abstract: true, discriminatorColumn: 'type' })
export abstract class Integration<TConfig extends Record<string, any> = any> {
	@primaryKey() id: string = crypto.randomUUID()

	@manyToOne(() => User, { mapToPk: true }) userId!: string

	@property({ type: 'string' }) type!: string
	@property({ type: 'json' }) config: TConfig = {} as TConfig

	@oneToMany(() => Source, source => source.integrationId) sources = new Collection<Source>(this)

	/**
	 * Synchronizes the integration with its external source.
	 * @param em The entity manager to use for database operations.
	 * @returns A promise that resolves to a boolean indicating whether any changes were made.
	 */
	abstract sync(em: EntityManager): Promise<boolean>

	/**
	 * Applies the desired state of `incoming` onto the persisted `existing` entry and
	 * pushes the change to the external source. The integration owns the strategy: it
	 * may diff `existing` against `incoming` for efficiency, or rewrite wholesale.
	 * @param em The entity manager to use for database operations.
	 * @param existing The currently persisted entry (managed).
	 * @param incoming A transient entry carrying the edited field values.
	 */
	abstract updateEntry(em: EntityManager, existing: Entry, incoming: Entry): Promise<void>

	/**
	 * Creates `entry` on the external source. `entry.sourceId` must already point at a
	 * target source belonging to this integration. Used when an entry is moved to a
	 * source of a different integration.
	 * @returns The created (persisted) entry.
	 */
	abstract createEntry(em: EntityManager, entry: Entry): Promise<Entry>

	/**
	 * Deletes `entry` from the external source and removes it locally.
	 */
	abstract deleteEntry(em: EntityManager, entry: Entry): Promise<void>
}
