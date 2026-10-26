import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { children } from '#infrastructure/model'
import { User, Identity } from '#features/identity'
import { Session } from '#features/identity/server/Session.js'
import { Source } from '#features/sources'
import { Entry, EntryType } from '#features/entries'
import { EntryRelation } from '#features/relations'
import { NotificationSubscription } from '#features/reminders/NotificationSubscription.js'
import { Integration } from '#integrations'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { LocationSuggestion } from '../LocationSuggestion.js'
import { recentLocations } from './recentLocations.js'

describe('recent locations', () => {
	let orm: MikroORM
	let em: EntityManager

	before(async () => {
		orm = await MikroORM.init({
			entities: [User, Identity, Session, Integration, MitraCalendar, Source, Entry, EntryRelation, NotificationSubscription],
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
		return user
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
			new LocationSuggestion({ name: 'Gym hall', detail: '', recent: true }),
			new LocationSuggestion({ name: 'Gym', detail: 'Park Road 3', recent: true }),
		])
	})

	it('suggests nothing for a user without a calendar', async () => {
		await userAt('Office')
		assert.deepEqual(await recentLocations(em, new User({ username: crypto.randomUUID() }), ''), [])
	})
})
