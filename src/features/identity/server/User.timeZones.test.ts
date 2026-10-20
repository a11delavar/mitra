import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { TimeZone } from '#features/time/TimeZone.js'
import { UserTimeZones } from '#features/time/UserTimeZones.js'
import { ormConfig } from '#infrastructure/database/ormConfig.js'
import { User } from '../User.js'

/** The account's zones as SQLite holds them, on the production entities. */
async function withDatabase(action: (orm: MikroORM) => Promise<void>) {
	const orm = await MikroORM.init(ormConfig(':memory:'))
	try {
		await orm.schema.update()
		await action(orm)
	} finally {
		await orm.close()
	}
}

const insert = (orm: MikroORM, timeZones: string | null) =>
	orm.em.getConnection().execute('insert into `user` (`id`, `username`, `time_zones`) values (?, ?, ?)', ['u', 'me', timeZones])

describe('User.timeZones in the database', () => {
	it('loads and saves an account that has kept no zone yet', () => withDatabase(async orm => {
		await insert(orm, null)
		const em = orm.em.fork()
		const user = await em.findOneOrFail(User, { id: 'u' })
		assert.ok(!user.timeZones)
		user.lastSeenVersion = '0.7.0'
		await em.flush()
	}))

	it('stores the zones and reads them back as the value object', () => withDatabase(async orm => {
		await insert(orm, null)
		const zones = UserTimeZones.none.settle(TimeZone.of('Europe/Berlin')).rename(TimeZone.of('Asia/Tokyo'), 'JP')
		const em = orm.em.fork()
		const user = await em.findOneOrFail(User, { id: 'u' })
		user.timeZones = zones
		await em.flush()

		const reloaded = await orm.em.fork().findOneOrFail(User, { id: 'u' })
		assert.ok(reloaded.timeZones instanceof UserTimeZones)
		assert.deepEqual(reloaded.timeZones.toJSON(), zones.toJSON())
	}))

	it('reads the plain list stored before home', () => withDatabase(async orm => {
		await insert(orm, '[{"id":"Asia/Tokyo","label":"JP"}]')
		const user = await orm.em.fork().findOneOrFail(User, { id: 'u' })
		assert.deepEqual(user.timeZones?.toJSON(), { others: [{ id: 'Asia/Tokyo', label: 'JP' }] })
	}))
})
