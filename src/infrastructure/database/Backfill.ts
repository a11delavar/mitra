import { type EntityManager, type MikroORM } from '@mikro-orm/core'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { State } from './State.js'

const logger = createLogger('Database')

/**
 * Work a migration leaves for the running app: what is stored, read and rewritten through the model, which a migration,
 * frozen on the tables of its day, cannot use. A migration asks for one by its name (`Backfill.asking`), it runs once the
 * migrations are through, as the server starts, and what asked for it is then forgotten. One that fails is asked again
 * at the next start.
 */
export abstract class Backfill {
	private static readonly prefix = 'backfill:'

	/** The statement a migration executes to ask for the backfill `name`. */
	static asking(name: string) {
		return `insert or replace into \`state\` (\`key\`, \`value\`) values ('${Backfill.prefix}${name}', 'true')`
	}

	/** Runs those of `backfills` a migration asked for. */
	static async runAsked(orm: MikroORM, backfills: ReadonlyArray<Backfill>) {
		const asked = await orm.em.fork().find(State, { key: { $like: `${Backfill.prefix}%` } })
		for (const { key } of asked) {
			const backfill = backfills.find(backfill => Backfill.prefix + backfill.name === key)
			if (!backfill) {
				logger.warn(`A migration asked for "${key}", which this version does not know`)
				continue
			}
			await backfill.run(orm.em.fork())
			await orm.em.fork().nativeDelete(State, { key })
			logger.info(`Ran the backfill "${backfill.name}"`)
		}
	}

	abstract readonly name: string

	abstract run(em: EntityManager): Promise<void>
}
