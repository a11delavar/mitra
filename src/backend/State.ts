import { entity, primaryKey, property } from '../shared/index.js'
import { orm } from './orm.js'

/**
 * A tiny key-value store for loose instance state (the Web Push VAPID keypair, the reminder scheduler's
 * watermark). Holding it in a table rather than in JSON files beside the database makes any point-in-time
 * copy of database.sqlite internally consistent: the whole instance is one atomic unit for backup and
 * restore, with no side files that must be copied together to stay valid. The table is added by
 * `orm.schema.update()` on boot like every other — no manual migration.
 */
@entity()
export class State {
	@primaryKey({ type: 'string' }) key!: string
	@property({ type: 'json' }) value!: unknown

	constructor(init?: Partial<State>) {
		Object.assign(this, init)
	}
}

/** Read a JSON state value by key, or `undefined` if it has never been set. */
export async function readState<T>(key: string): Promise<T | undefined> {
	const em = orm.em.fork()
	const row = await em.findOne(State, { key })
	return row?.value as T | undefined
}

/** Upsert a JSON state value in place. */
export async function writeState<T>(key: string, value: T): Promise<void> {
	const em = orm.em.fork()
	const row = await em.findOne(State, { key }) ?? new State({ key })
	row.value = value
	em.persist(row)
	await em.flush()
}
