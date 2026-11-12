import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { DateTime } from '@3mo/date-time'
import { User } from '#features/identity'
import { Source } from '#features/sources'
import { Entry, EntryType } from '#features/entries'
import { Recurrence, RecurrenceFrequency } from '#features/recurrence'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { ormConfig } from '#infrastructure/database/ormConfig.js'
import { migrate } from '#infrastructure/database/migrations/migrate.js'

describe('RoutineSubscriber', () => {
	const start = new DateTime('2026-03-02T07:00:00.000Z')

	let orm: MikroORM
	let source: Source
	before(async () => {
		orm = await MikroORM.init(ormConfig(':memory:'))
		await migrate(orm)
		const em = orm.em.fork()
		const user = new User({ username: 'subscriber' })
		const integration = new MitraCalendar({ userId: user.id, uri: MitraCalendar.uri })
		source = new Source({ integrationId: integration.id, uri: MitraCalendar.sourceUri('home'), name: 'Home', entryTypes: [EntryType.Event], enabled: true, hidden: false })
		em.persist([user, integration, source])
		await em.flush()
	})
	after(() => orm.close())

	const event = (heading: string, at = start, init: Partial<Entry> = {}) => new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading, start: at, end: at.add({ hours: 1 }), ...init })
	const stored = async (id: string) => (await orm.em.fork().findOneOrFail(Entry, { id })).routineId

	it('passes over entries a flush leaves as they were, however many it has loaded', async () => {
		const em = orm.em.fork()
		const walk = event('Walk')
		em.persist(walk)
		await em.flush()
		// A routine wearing its title arrives by another way; loading the entry and flushing something else must not touch it.
		await orm.em.getConnection().execute('insert into `routine` (`id`, `source_id`) values (?, ?)', ['walks', source.id])
		await orm.em.getConnection().execute('insert into `entry` (`id`, `source_id`, `type`, `heading`, `start`, `routine_id`) values (?, ?, ?, ?, ?, ?)', ['walked', source.id, 'event', 'Walk', start.valueOf(), 'walks'])
		const reading = orm.em.fork()
		await reading.find(Entry, { sourceId: source.id })
		reading.persist(event('Dentist'))
		await reading.flush()
		assert.equal(await stored(walk.id!), undefined)
	})

	it('places what one flush writes together: a recurring entry, its override and an entry wearing its title', async () => {
		const em = orm.em.fork()
		const stretch = event('Stretch', start, { recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
		const moved = start.add({ days: 2 })
		const override = event('Stretch in the park', moved, { recurringEntryId: stretch.id, recurrenceId: moved })
		const beside = event('stretch', start.add({ days: 5 }))
		em.persist([beside, override, stretch])
		await em.flush()
		assert.ok(stretch.routineId)
		assert.deepEqual([await stored(override.id!), await stored(beside.id!)], [stretch.routineId, stretch.routineId])
	})

	it('counts an entry the flush removes no more, and one it renames by its new title', async () => {
		const em = orm.em.fork()
		const swims = [0, 3, 6].map(days => event('Swim', start.add({ days })))
		const other = event('Sauna', start.add({ days: 9 }))
		em.persist([...swims, other])
		await em.flush()
		em.remove(swims[0]!)
		other.heading = 'Swim'
		em.persist(event('Swim', start.add({ days: 12 })))
		await em.flush()
		// Three stored, less one, with the renamed one and the new one: four.
		assert.ok(other.routineId)
		assert.deepEqual(await Promise.all(swims.slice(1).map(swim => stored(swim.id!))), [other.routineId, other.routineId])
	})
})
