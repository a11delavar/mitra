import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../User.js'
import { Identity } from '../Identity.js'
import { Source } from '../../sources/Source.js'
import { Entry } from '../../entries/Entry.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { Integration } from '../../../integrations/Integration.js'
import { MitraCalendar } from '../../../integrations/mitra/MitraCalendar.js'
import { Demo } from '../../../integrations/demo/Demo.js'
import { Session } from './Session.js'
import { Sandbox } from './Sandbox.js'

let orm: MikroORM

describe('Sandbox', () => {
	before(async () => {
		orm = await MikroORM.init({
			entities: [User, Identity, Integration, MitraCalendar, Demo, Source, Entry, Recurrence, EntryRelation, Session],
			dbName: ':memory:',
			namingStrategy: class extends UnderscoreNamingStrategy {
				override joinColumnName(propertyName: string) {
					return this.propertyToColumnName(propertyName)
				}

				override joinKeyColumnName(entityName: string) {
					return this.propertyToColumnName(entityName)
				}
			},
			allowGlobalContext: true,
		})
		await orm.schema.update()
	})
	after(async () => { await orm.close(true) })

	it('opens with the sample calendar already imported', async () => {
		const em = orm.em.fork()
		const { user } = await Sandbox.open(em)

		const integrations = await em.find(Integration, { userId: user.id })
		assert.deepEqual(integrations.map(integration => integration.type), ['demo'])
		const sources = await em.find(Source, { integrationId: integrations[0]!.id })
		assert.ok(sources.length > 0)
		assert.ok(sources.every(source => !source.importing))
		assert.ok(await em.count(Entry, { sourceId: { $in: sources.map(source => source.id) } }) > 0)
	})

	it('opens together with the session of its visit', async () => {
		const em = orm.em.fork()
		const { user, token } = await Sandbox.open(em)

		const session = await em.findOne(Session, { id: Session.idFor(token) })
		assert.equal(session?.userId, user.id)
	})

	it('evicts the oldest sandboxes past the count, with everything in them, and nobody else', async () => {
		const em = orm.em.fork()
		await Sandbox.evict(em, 0)
		const bystander = new User({ username: 'bystander' })
		em.persist([bystander, new MitraCalendar({ userId: bystander.id })])
		await em.flush()

		const oldest = await openedHoursAgo(em, 3)
		const older = await openedHoursAgo(em, 2)
		const newest = await openedHoursAgo(em, 1)

		assert.equal(await Sandbox.evict(em, 1), 2)

		em.clear()
		const remaining = await em.find(User, {})
		assert.deepEqual(remaining.map(user => user.id).sort(), [bystander.id, newest.id].sort())
		const integrations = await em.find(Integration, {})
		assert.deepEqual(integrations.map(integration => integration.userId).sort(), [bystander.id, newest.id].sort())
		assert.equal(await em.count(Source, { integrationId: { $nin: integrations.map(integration => integration.id) } }), 0)
		assert.equal(await em.count(Session, { userId: { $in: [oldest.id, older.id] } }), 0)
	})

	it('evicts every sandbox past its lifetime as the next one opens, however few there are', async () => {
		const em = orm.em.fork()
		await Sandbox.evict(em, 0)
		const expired = await openedHoursAgo(em, 25)
		const fresh = await openedHoursAgo(em, 23)
		await Sandbox.open(em)

		em.clear()
		assert.equal(await em.count(User, { id: expired.id }), 0)
		assert.equal(await em.count(User, { id: fresh.id }), 1)
	})
})

async function openedHoursAgo(em: EntityManager, hours: number) {
	const { user, token } = await Sandbox.open(em)
	const session = await em.findOneOrFail(Session, { id: Session.idFor(token) })
	session.expiresAt = new Date(Date.now() + Session.lifetime - hours * 3_600_000)
	await em.flush()
	return user
}
