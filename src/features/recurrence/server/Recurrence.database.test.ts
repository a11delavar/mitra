import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM } from '@mikro-orm/sqlite'
import { ormConfig } from '../../../infrastructure/database/ormConfig.js'
import { User } from '../../identity/User.js'
import { Source } from '../../sources/Source.js'
import { Entry } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { MitraCalendar } from '../../../integrations/mitra/MitraCalendar.js'
import { Recurrence } from '../Recurrence.js'
import { RecurrenceEnd } from '../RecurrenceEnd.js'
import { RecurrenceFrequency } from '../RecurrenceFrequency.js'
import { RecurrenceWeekday } from '../RecurrenceWeekday.js'

/** A rule as SQLite holds it, on the production entities. */
async function withEntry(recurrence: Recurrence | undefined, action: (orm: MikroORM, id: string) => Promise<void>) {
	const orm = await MikroORM.init(ormConfig(':memory:'))
	try {
		await orm.schema.update()
		const em = orm.em.fork()
		const user = new User({ username: 'me' })
		const integration = new MitraCalendar({ userId: user.id, uri: 'mitra://local' })
		const source = new Source({ integrationId: integration.id, uri: 'mitra://calendar/1', entryTypes: [EntryType.Event], name: 'Calendar', enabled: true, hidden: false })
		const id = crypto.randomUUID()
		const entry = new Entry({ id, sourceId: source.id, type: EntryType.Event, heading: 'Standup', start: new Date('2026-06-01T09:00:00Z') as never, recurrence })
		em.persist([user, integration, source, entry])
		await em.flush()
		await action(orm, id)
	} finally {
		await orm.close()
	}
}

const columns = async (orm: MikroORM, id: string) =>
	(await orm.em.getConnection().execute('select `recurrence_freq`, `recurrence_byday`, `recurrence_until` from `entry` where `id` = ?', [id]))[0]

describe('Recurrence in the database', () => {
	const rule = new Recurrence({
		freq: RecurrenceFrequency.Monthly,
		byday: [RecurrenceWeekday.Monday, RecurrenceWeekday.Friday.nth(-1)],
		until: new RecurrenceEnd(Temporal.PlainDate.from('2026-07-18')),
	})

	it('stores the columns as they always were: the code, the BYDAY parts and UTC midnight in epoch milliseconds', () => withEntry(rule, async (orm, id) => {
		assert.deepEqual({ ...await columns(orm, id) }, {
			recurrence_freq: 'MONTHLY',
			recurrence_byday: '["MO","-1FR"]',
			recurrence_until: Date.parse('2026-07-18T00:00:00Z'),
		})
	}))

	it('reads them back as the value objects', () => withEntry(rule, async (orm, id) => {
		const entry = await orm.em.fork().findOneOrFail(Entry, { id })
		assert.equal(entry.recurrence!.freq, RecurrenceFrequency.Monthly)
		assert.equal(entry.recurrence!.byday![0], RecurrenceWeekday.Monday)
		assert.ok(entry.recurrence!.byday![1]!.equals(RecurrenceWeekday.Friday.nth(-1)))
		assert.ok(entry.recurrence!.until!.equals(rule.until))
		assert.ok(entry.recurrence!.equals(rule))
	}))

	it('leaves a loaded rule unchanged on the next flush', () => withEntry(rule, async (orm, id) => {
		const em = orm.em.fork()
		await em.findOneOrFail(Entry, { id })
		em.getUnitOfWork().computeChangeSets()
		const changed = em.getUnitOfWork().getChangeSets().flatMap(set => Object.keys(set.payload))
		assert.deepEqual(changed.filter(column => column.startsWith('recurrence')), [])
	}))

	it('finds masters by their frequency', () => withEntry(rule, async orm => {
		const em = orm.em.fork()
		assert.equal(await em.count(Entry, { recurrence: { freq: { $ne: null } } }), 1)
		assert.equal(await em.count(Entry, { recurrence: { freq: null } }), 0)
	}))

	it('keeps the columns empty without a rule', () => withEntry(undefined, async (orm, id) => {
		assert.deepEqual({ ...await columns(orm, id) }, { recurrence_freq: null, recurrence_byday: null, recurrence_until: null })
		assert.equal(await orm.em.fork().count(Entry, { recurrence: { freq: null } }), 1)
	}))
})
