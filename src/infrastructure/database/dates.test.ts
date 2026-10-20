import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '#features/identity'
import { Session } from '#features/identity/server/Session.js'
import { Source } from '#features/sources'
import { Entry, EntryType } from '#features/entries'
import { NotificationSubscription } from '#features/reminders/NotificationSubscription.js'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { ormConfig } from './ormConfig.js'

const changes = (em: EntityManager) => {
	em.getUnitOfWork().computeChangeSets()
	return em.getUnitOfWork().getChangeSets().map(set => ({ entity: set.entity.constructor.name, payload: set.payload }))
}

// MikroORM compares a `'datetime'` column with `equals`, so the Date it loads never matched the milliseconds SQLite keeps,
// and every flush rewrote every date it had loaded. Date columns are typed `'Date'`, which it compares by value.
describe('Dates in the database', () => {
	it('leave what was loaded unchanged, and still save an edit', async () => {
		const orm = await MikroORM.init(ormConfig(':memory:'))
		try {
			await orm.schema.update()
			const at = (iso: string) => new Date(iso) as never
			const em = orm.em.fork()
			const user = new User({ username: 'me' })
			const integration = new MitraCalendar({ userId: user.id, uri: 'mitra://local' })
			const source = new Source({ integrationId: integration.id, uri: 'mitra://calendar/1', entryTypes: [EntryType.Task], name: 'Calendar', enabled: true, hidden: false, importedAt: at('2026-06-01T08:00:00Z') })
			const id = crypto.randomUUID()
			const entry = new Entry({ id, sourceId: source.id, type: EntryType.Task, heading: 'Report', start: at('2026-06-01T09:00:00Z'), end: at('2026-06-01T10:00:00Z'), due: at('2026-06-05T17:00:00Z'), recurrenceId: at('2026-06-01T09:00:00Z') })
			const device = new NotificationSubscription({ id: 'device', userId: user.id, endpoint: 'https://push.example.com/device', keys: { p256dh: 'key', auth: 'auth' }, lastSeenAt: at('2026-06-01T08:30:00Z') })
			em.persist([user, integration, source, entry, device, Session.issue(user).session])
			await em.flush()

			const fork = orm.em.fork()
			const loaded = await fork.findOneOrFail(Entry, { id })
			await fork.findOneOrFail(Source, { id: source.id })
			await fork.findOneOrFail(NotificationSubscription, { id: 'device' })
			await fork.findOneOrFail(Session, { userId: user.id })
			assert.deepEqual(changes(fork), [])

			loaded.start = at('2026-06-01T11:00:00Z')
			assert.deepEqual(changes(fork), [{ entity: 'Entry', payload: { start: Date.parse('2026-06-01T11:00:00Z') } }])
		} finally {
			await orm.close()
		}
	})
})
