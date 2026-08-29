import { type EntityManager } from '@mikro-orm/core'
import { entity, primaryKey, property } from '../model/orm.js'

/** Key-value store for instance metadata and state in SQLite. */
@entity()
export class State {
	@primaryKey({ type: 'string' }) key!: string
	@property({ type: 'json' }) value!: unknown

	constructor(init?: Partial<State>) {
		Object.assign(this, init)
	}

	/** Read a JSON state value by key, or `undefined` if it has never been set. */
	static async read<T>(em: EntityManager, key: string): Promise<T | undefined> {
		const row = await em.findOne(State, { key })
		return row?.value as T | undefined
	}

	/** Upsert a JSON state value in place. */
	static async write<T>(em: EntityManager, key: string, value: T): Promise<void> {
		const row = await em.findOne(State, { key }) ?? new State({ key })
		row.value = value
		em.persist(row)
		await em.flush()
	}
}
