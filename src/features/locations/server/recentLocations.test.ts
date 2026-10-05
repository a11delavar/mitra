import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../identity/User.js'
import { Identity } from '../../identity/Identity.js'
import { Session } from '../../identity/server/Session.js'
import { Source } from '../../sources/Source.js'
import { Entry } from '../../entries/Entry.js'
import { EntryType } from '../../entries/EntryType.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { Recurrence } from '../../recurrence/Recurrence.js'
import { NotificationSubscription } from '../../reminders/NotificationSubscription.js'
import { Integration } from '../../../integrations/Integration.js'
import { MitraCalendar } from '../../../integrations/mitra/MitraCalendar.js'
import { recentLocations } from './recentLocations.js'

describe('recent locations', () => {
	let orm: MikroORM
	let em: EntityManager

	before(async () => {
		orm = await MikroORM.init({
			entities: [User, Identity, Session, Integration, MitraCalendar, Source, Entry, EntryRelation, Recurrence, NotificationSubscription],
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
		em = orm.em.fork()
	})
	after(() => orm.close(true))

	/** A user with one calendar holding entries at the places given, the last the latest. */
	async function userAt(...locations: Array<string>) {
		const user = new User({ username: crypto.randomUUID() })
		const integration = new MitraCalendar({ userId: user.id, uri: `dev://${user.id}` })
		const source = new Source({ integrationId: integration.id, uri: `${user.id}/calendar`, name: 'Calendar', enabled: true })
		em.persist([user, integration, source, ...locations.map((location, index) => new Entry({
			id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Event, heading: location, location,
			start: new Date(Date.UTC(2026, 9, 1 + index, 9)) as never, end: new Date(Date.UTC(2026, 9, 1 + index, 10)) as never,
		}))])
		await em.flush()
		return [source.id]
	}

	it('suggests only the places the user has been, never another user\'s', async () => {
		const mine = await userAt('Dentist, Main Street 1', 'Office')
		await userAt('Their therapist, Elm Street 2')

		assert.deepEqual((await recentLocations(em, mine, '')).map(place => place.name), ['Office', 'Dentist'])
		assert.deepEqual(await recentLocations(em, mine, 'therapist'), [])
	})

	it('names the places matching what was typed, newest first, with the rest of the address as their detail', async () => {
		const mine = await userAt('Gym, Park Road 3', 'Studio', 'Gym hall')

		assert.deepEqual(await recentLocations(em, mine, 'gym'), [
			{ name: 'Gym hall', detail: '', recent: true },
			{ name: 'Gym', detail: 'Park Road 3', recent: true },
		])
	})

	it('suggests nothing for a user without a calendar', async () => {
		await userAt('Office')
		assert.deepEqual(await recentLocations(em, [], ''), [])
	})
})
