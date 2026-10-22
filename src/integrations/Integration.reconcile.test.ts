import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { children } from '#infrastructure/model'
import { User, Identity } from '#features/identity'
import { Source } from '#features/sources'
import { Entry, EntryType } from '#features/entries'
import { EntryRelation } from '#features/relations'
import { Integration } from './Integration.js'
import { MitraCalendar } from './mitra/MitraCalendar.js'

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, MitraCalendar, Source, Entry, EntryRelation],
		dbName: ':memory:',
		subscribers: [children.subscriber],
		forceUndefined: true,
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

const google = (calendar: string) => `https://apidata.googleusercontent.com/caldav/v2/${calendar}/events/`

let orm: MikroORM
let users = 0

/** An account whose provider lists what `listing` says, holding one enabled calendar with an entry. */
async function seed(em: EntityManager, uri: string) {
	const user = new User({ username: `user-${++users}` })
	const integration = new MitraCalendar({ userId: user.id })
	em.persist([user, integration])
	await em.flush()
	const source = new Source({ integrationId: integration.id, uri, name: 'Personal', enabled: true })
	em.persist(source)
	const entry = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: 'Dentist' })
	em.persist(entry)
	await em.flush()
	const listing = { calendars: [] as Array<string> }
	// The provider's answer, as a remote account's engine gives it.
	Object.assign(integration, { fetchSources: () => Promise.resolve(listing.calendars.map(calendar => new Source({ uri: calendar, name: 'Personal', enabled: false }))) })
	return { integration, source, entry, listing }
}

/** What was logged while `work` ran: consola copies its reporters into each tagged logger, so the output is read instead. */
async function logged(work: () => Promise<unknown>) {
	const messages = new Array<string>()
	const streams = [process.stdout, process.stderr]
	const writes = streams.map(stream => stream.write)
	for (const stream of streams) {
		stream.write = ((chunk: string | Uint8Array) => messages.push(String(chunk)) > 0) as typeof stream.write
	}
	try {
		await work()
	} finally {
		streams.forEach((stream, index) => stream.write = writes[index]!)
	}
	return messages
}

describe('Reconciling an account\'s calendars', () => {
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	// Google's CalDAV signs in with an access token that expires hourly; a refused listing reads as none.
	it('keeps the stored calendars and their entries when the provider lists none', async () => {
		const em = orm.em.fork()
		const { integration, source, entry } = await seed(em, google('me%40gmail.com'))

		const messages = await logged(async () => {
			await integration.getSources(em)
			await em.flush()
		})

		const stored = await orm.em.fork().findOneOrFail(Source, { id: source.id })
		assert.equal(stored.enabled, true)
		assert.equal(await orm.em.fork().count(Entry, { id: entry.id }), 1)
		assert.ok(messages.some(message => /listed no calendars/.test(message)), messages.join('\n'))
	})

	it('keeps a calendar whose address the provider spells another way, switched on and with its entries', async () => {
		const em = orm.em.fork()
		const { integration, source, entry, listing } = await seed(em, google('me%40gmail.com'))
		listing.calendars = ['https://apidata.googleusercontent.com/caldav/v2/me@gmail.com/events']

		const [kept] = await integration.getSources(em)
		await em.flush()

		assert.equal(kept!.id, source.id)
		const stored = await orm.em.fork().findOneOrFail(Source, { id: source.id })
		assert.equal(stored.enabled, true)
		assert.equal(stored.uri, listing.calendars[0], 'it takes the spelling the provider uses now')
		assert.equal(await orm.em.fork().count(Source, { integrationId: integration.id }), 1)
		assert.equal(await orm.em.fork().count(Entry, { id: entry.id }), 1)
	})

	it('still removes a calendar the provider no longer lists, and says so', async () => {
		const em = orm.em.fork()
		const { integration, source, listing } = await seed(em, google('me%40gmail.com'))
		listing.calendars = [google('team%40group.calendar.google.com')]

		const messages = await logged(async () => {
			await integration.getSources(em)
			await em.flush()
		})

		assert.equal(await orm.em.fork().count(Source, { id: source.id }), 0)
		assert.ok(messages.some(message => /Removed calendar "Personal"/.test(message) && message.includes(source.uri)), messages.join('\n'))
		assert.ok(messages.some(message => /Added calendar/.test(message) && message.includes('team%40group.calendar.google.com')), messages.join('\n'))
	})
})
