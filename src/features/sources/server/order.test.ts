import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../identity/User.js'
import { Source } from '../Source.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { applyOrder, byOrder } from '../../../infrastructure/model/order.js'
import { Integration } from '../../../integrations/Integration.js'
import { Identity } from '../../identity/Identity.js'
import { GoogleCalendar } from '../../../integrations/google/GoogleCalendar.js'
import { EntryType } from '../../entries/EntryType.js'
import { Entry } from '../../entries/Entry.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { AppleCalendar } from '../../../integrations/apple/AppleCalendar.js'
import { Dev } from '../../../integrations/dev/Dev.js'
import { NotificationSubscription } from '../../reminders/NotificationSubscription.js'
import { Session } from '../../identity/server/Session.js'

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Dev, Source, Entry, Recurrence, NotificationSubscription, Session],
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
	return orm
}

async function seedUser(em: EntityManager, username: string, names: Array<string>) {
	const user = new User({ username })
	const integration = new Dev({ userId: user.id, uri: `dev://${username}` })
	const sources = names.map(name => new Source({ integrationId: integration.id, uri: `${username}/${name}`, entryTypes: [EntryType.Event], name, enabled: true }))
	em.persist([user, integration, ...sources])
	await em.flush()
	return { user, integration, sources }
}

const displayed = async (em: EntityManager, integrationId: string) =>
	(await em.find(Source, { integrationId })).sort(byOrder)

describe('sidebar manual order', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('never-ordered rows read back in insertion order', async () => {
		const em = orm.em.fork()
		const { integration, sources } = await seedUser(em, 'insertion', ['a', 'b', 'c', 'd'])
		const rows = await displayed(em, integration.id)
		assert.deepEqual(rows.map(source => source.id), sources.map(source => source.id))
	})

	it('listed rows take their index, the null rest appends in insertion order', async () => {
		const em = orm.em.fork()
		const { integration, sources: [a, b, c, d] } = await seedUser(em, 'partial', ['a', 'b', 'c', 'd'])
		applyOrder(await em.find(Source, { integrationId: integration.id }), [c!.id, a!.id])
		await em.flush()
		const rows = await displayed(em, integration.id)
		assert.deepEqual(rows.map(source => source.name), ['c', 'a', 'b', 'd'])
		assert.equal(b!.order, null)
		assert.equal(d!.order, null)
	})

	it('a later wholesale write resets every unlisted sibling — stale numbers never interleave', async () => {
		const em = orm.em.fork()
		const { integration, sources: [a, b, c, d] } = await seedUser(em, 'reset', ['a', 'b', 'c', 'd'])
		const siblings = await em.find(Source, { integrationId: integration.id })
		applyOrder(siblings, [d!.id, c!.id, b!.id, a!.id])
		await em.flush()
		applyOrder(siblings, [b!.id])
		await em.flush()
		const rows = await displayed(em, integration.id)
		assert.deepEqual(rows.map(source => source.name), ['b', 'a', 'c', 'd'])
	})

	it('a reorder round-trips losslessly: writing what is displayed reads back identically', async () => {
		const em = orm.em.fork()
		const { integration } = await seedUser(em, 'mirror', ['a', 'b', 'c', 'd'])
		const siblings = await em.find(Source, { integrationId: integration.id })
		applyOrder(siblings, [siblings[3]!.id, siblings[1]!.id])
		await em.flush()
		const shown = await displayed(em, integration.id)
		applyOrder(siblings, shown.map(source => source.id))
		await em.flush()
		assert.deepEqual((await displayed(em, integration.id)).map(source => source.id), shown.map(source => source.id))
	})

	it('integrations sort the same way: placed ones first, connection order for the rest', async () => {
		const em = orm.em.fork()
		const user = new User({ username: 'accounts' })
		const integrations = ['one', 'two', 'three'].map(name => new Dev({ userId: user.id, uri: `dev://accounts/${name}` }))
		em.persist([user, ...integrations])
		await em.flush()
		applyOrder(integrations, [integrations[2]!.id])
		await em.flush()
		const rows = (await em.find(Integration, { userId: user.id })).sort(byOrder)
		assert.deepEqual(rows.map(integration => integration.uri), ['dev://accounts/three', 'dev://accounts/one', 'dev://accounts/two'])
	})

	it('the reorder route\'s ownership check: a foreign id never resolves through user.sources', async () => {
		const em = orm.em.fork()
		const alice = await seedUser(em, 'alice', ['a'])
		const bob = await seedUser(em, 'bob', ['b'])
		const ids = [alice.sources[0]!.id, bob.sources[0]!.id]
		const resolved = await alice.user.sources(em, { id: { $in: ids } })
		assert.equal(resolved.length, 1) // fewer than requested — the route 404s exactly this
		assert.equal(resolved[0]!.id, alice.sources[0]!.id)
	})
})
