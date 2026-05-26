import { entity, primaryKey, property, manyToOne, oneToMany, cascade } from './orm.js'
import { User } from './User.js'
import { Collection } from './orm.js'
import { Source } from './Source.js'
import type { EntityManager } from '@mikro-orm/core'

@entity({ abstract: true, discriminatorColumn: 'type' })
export abstract class Integration<TConfig extends Record<string, any> = any> {
	@primaryKey() id = crypto.randomUUID() as string
	@manyToOne(() => User) user!: User
	@property({ type: 'string' }) type!: string
	@property({ type: 'json' }) config: TConfig = {} as TConfig
	@oneToMany(() => Source, source => source.integration, { cascade: [cascade.ALL] }) sources = new Collection<Source>(this)

	/**
	 * Synchronizes the integration with its external source.
	 * @param em The entity manager to use for database operations.
	 * @returns A promise that resolves to a boolean indicating whether any changes were made.
	 */
	abstract sync(em: EntityManager): Promise<boolean>
}
