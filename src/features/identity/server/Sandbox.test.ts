import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy } from '@mikro-orm/sqlite'
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
		const user = await Sandbox.open(em)

		const integrations = await em.find(Integration, { userId: user.id })
		assert.deepEqual(integrations.map(integration => integration.type), ['demo'])
		const sources = await em.find(Source, { integrationId: integrations[0]!.id })
		assert.ok(sources.length > 0)
		assert.ok(sources.every(source => !source.importing))
		assert.ok(await em.count(Entry, { sourceId: { $in: sources.map(source => source.id) } }) > 0)
	})

	it('evicts the least recently seen sandboxes with everything in them, and nobody else', async () => {
		const em = orm.em.fork()
		await Sandbox.evictDownTo(em, 0)
		const bystander = new User({ username: 'bystander' })
		em.persist([bystander, new MitraCalendar({ userId: bystander.id })])
		await em.flush()

		const unseen = await Sandbox.open(em)
		const earlier = await Sandbox.open(em)
		const later = await Sandbox.open(em)
		const seenAt = (user: User, hoursFromNow: number) => em.persist(new Session({ id: user.id, userId: user.id, expiresAt: new Date(Date.now() + hoursFromNow * 3_600_000) }))
		seenAt(earlier, 1)
		seenAt(later, 2)
		await em.flush()

		assert.equal(await Sandbox.evictDownTo(em, 1), 2)

		em.clear()
		const remaining = await em.find(User, {})
		assert.deepEqual(remaining.map(user => user.id).sort(), [bystander.id, later.id].sort())
		const integrations = await em.find(Integration, {})
		assert.deepEqual(integrations.map(integration => integration.userId).sort(), [bystander.id, later.id].sort())
		assert.equal(await em.count(Source, { integrationId: { $nin: integrations.map(integration => integration.id) } }), 0)
		assert.equal(await em.count(Session, { userId: { $in: [unseen.id, earlier.id] } }), 0)
	})
})
