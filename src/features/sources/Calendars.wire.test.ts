import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { Api } from '@a11d/api'
import '@3mo/date-time-value-constructor'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { User } from '#features/identity'
import { EntryType } from '#features/entries'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { IcsSubscription } from '#integrations/ics/IcsSubscription.js'
import type { Integration } from '#integrations'
import { ConnectIntegration } from '#integrations/server/ConnectIntegration.js'
import { DisconnectIntegration } from '#integrations/server/DisconnectIntegration.js'
import { DiscoverSources } from '#integrations/server/DiscoverSources.js'
import { ReimportIntegration } from '#integrations/server/ReimportIntegration.js'
import { ReorderIntegrations } from '#integrations/server/ReorderIntegrations.js'
import { UpdateIntegration } from '#integrations/server/UpdateIntegration.js'
import { CreateSource } from './server/CreateSource.js'
import { SetSourceVisibility } from './server/SetSourceVisibility.js'
import { DeleteSource } from './server/DeleteSource.js'
import { RecolorSource } from './server/RecolorSource.js'
import { ReorderSources } from './server/ReorderSources.js'
import { Calendars } from './client/Calendars.js'
import { Source } from './Source.js'
import { RenameSource } from './server/RenameSource.js'
import { Color } from './Color.js'

/*
	An account's integrations and calendars through the app's own API client and its calendar store, the real routes and a
	database: what the sidebar would show after each change, a feed served here connected, imported, edited and re-imported
	as a remote calendar is.
*/

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** A feed of `headings`, one event a day from 2026-10-20 on. */
const feedOf = (headings: Array<string>) => [
	'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//mitra//test//EN', 'X-WR-CALNAME:Team holidays',
	...headings.flatMap((heading, index) => [
		'BEGIN:VEVENT', `UID:feed-${index}@example.com`, 'DTSTAMP:20261001T000000Z',
		`DTSTART:202610${20 + index}T090000Z`, `DTEND:202610${20 + index}T100000Z`, `SUMMARY:${heading}`, 'END:VEVENT',
	]),
	'END:VCALENDAR',
].join('\r\n')

describe('Integrations and calendars over the wire', () => {
	let app: Server
	let feed: Server
	let feedUrl: string
	let feedBody = feedOf(['Retro', 'Offsite'])
	let current: User
	let owner: User
	let stranger: User
	let entriesIn: (sourceId: string) => Promise<number>
	let closeOrm: () => Promise<void>

	before(async () => {
		const { orm } = await import('#infrastructure/database/orm.js')
		await import('#integrations/server/registerEngines.js')
		const { operationsRouter } = await import('#infrastructure/operations/server/operationsRouter.js')
		await import('#app/operations.js')

		const em = orm.em.fork()
		owner = new User({ username: 'owner' })
		stranger = new User({ username: 'stranger' })
		const mine = new MitraCalendar({ userId: owner.id, uri: MitraCalendar.uri })
		const theirs = new MitraCalendar({ userId: stranger.id, uri: MitraCalendar.uri })
		em.persist([
			owner, stranger, mine, theirs,
			new Source({ integrationId: mine.id, uri: MitraCalendar.sourceUri('home'), name: 'Home', entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false, order: 0 }),
			new Source({ integrationId: mine.id, uri: MitraCalendar.sourceUri('work'), name: 'Work', entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false, order: 1 }),
			new Source({ integrationId: theirs.id, uri: MitraCalendar.sourceUri('private'), name: 'Private', entryTypes: [EntryType.Event], enabled: true, hidden: false }),
		])
		await em.flush()
		current = owner

		const connection = orm.em.getConnection()
		entriesIn = async sourceId => Number((await connection.execute('select count(*) as count from entry where source_id = ?', [sourceId]))[0]?.count ?? 0)
		closeOrm = () => orm.close()

		feed = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/calendar' }).end(feedBody))
		await new Promise<void>(resolve => feed.listen(0, resolve))
		feedUrl = `http://localhost:${(feed.address() as AddressInfo).port}/holidays.ics`

		const models = new ModelValueConstructor()
		const server = express()
		server.use((req, _res, next) => {
			req.user = current
			next()
		})
		server.use(express.json({ reviver: (_key, value) => models.shallConstruct(value) ? models.construct(value) : value }))
		server.use('/api', operationsRouter(() => orm.em.fork()))
		app = await new Promise<Server>(resolve => {
			const listening = server.listen(0, () => resolve(listening))
		})
		Api.url = `http://localhost:${(app.address() as AddressInfo).port}/api`
		// @a11d/api sets `referrer: 'no-referrer'`, which a browser resolves against the page and Node's fetch refuses.
		const browserFetch = globalThis.fetch
		globalThis.fetch = (input, init) => browserFetch(input, { ...init, referrer: undefined })
	})

	after(async () => {
		await new Promise(resolve => app.close(resolve))
		await new Promise(resolve => feed.close(resolve))
		await closeOrm()
	})

	/** The integrations and their calendars as the sidebar reads them, in the user's order. */
	const shown = async () => {
		await Calendars.fetch()
		return Calendars.integrations.map(integration => ({
			type: integration.type,
			calendars: integration.sources.map(source => source.name),
		}))
	}
	const mitra = () => Calendars.integrations.find(integration => integration instanceof MitraCalendar)!
	const calendar = (name: string) => Calendars.sources.find(source => source.name === name)!
	/** Waits for `condition`, as the sidebar waits for an import to end. */
	const until = async (condition: () => Promise<boolean>, ms = 10_000) => {
		const deadline = Date.now() + ms
		while (!await condition()) {
			if (Date.now() > deadline) {
				throw new Error('Timed out')
			}
			await sleep(100)
		}
	}

	describe('a Mitra calendar', () => {
		it('lists each integration with its calendars, loaded with it, as real instances', async () => {
			assert.deepEqual(await shown(), [{ type: 'mitra', calendars: ['Home', 'Work'] }])
			assert.ok(mitra() instanceof MitraCalendar)
			assert.ok(Array.isArray(mitra().sources))
			assert.ok(mitra().sources.every(source => source instanceof Source))
		})

		it('creates a calendar, which the next listing shows', async () => {
			const created = await CreateSource.call({ id: mitra().id, name: 'Garden' })
			assert.equal(created.name, 'Garden')
			assert.deepEqual((await shown())[0]!.calendars.sort(), ['Garden', 'Home', 'Work'])
		})

		it('renames and recolors a calendar', async () => {
			await shown()
			const garden = calendar('Garden').id
			await RenameSource.call({ id: garden, name: 'Allotment' })
			await RecolorSource.call({ id: garden, color: Color.parse('#336699')! })
			await shown()
			assert.deepEqual([calendar('Allotment').id, calendar('Allotment').color], [garden, Color.parse('#336699')])
		})

		it('keeps the calendars in the order they were put in', async () => {
			await shown()
			const reversed = [...mitra().sources].reverse()
			await ReorderSources.call({ ids: reversed.map(source => source.id) })
			assert.deepEqual((await shown())[0]!.calendars, reversed.map(source => source.name))
		})

		it('hides and shows a calendar, which stays where entries may live', async () => {
			await shown()
			await SetSourceVisibility.call({ id: calendar('Work').id, hidden: true })
			await shown()
			assert.equal(calendar('Work').hidden, true)
			assert.ok(Calendars.enabled().some(source => source.name === 'Work'))
			await SetSourceVisibility.call({ id: calendar('Work').id, hidden: false })
			await shown()
			assert.equal(calendar('Work').hidden, false)
		})

		it('deletes a calendar, which the next listing leaves out', async () => {
			await shown()
			await DeleteSource.call({ id: calendar('Allotment').id })
			assert.deepEqual((await shown())[0]!.calendars.sort(), ['Home', 'Work'])
		})
	})

	describe('a feed, as a remote calendar is connected', () => {
		let subscription: Integration

		it('discovers the feed\'s calendar', async () => {
			const discovered = await DiscoverSources.call({ integration: new IcsSubscription({ uri: feedUrl }) })
			assert.equal(discovered.length, 1)
			assert.ok(discovered[0] instanceof Source)
		})

		it('connects with the calendars chosen, then imports their entries in the background', async () => {
			const discovered = await DiscoverSources.call({ integration: new IcsSubscription({ uri: feedUrl }) })
			subscription = await ConnectIntegration.call({ integration: new IcsSubscription({ uri: feedUrl, sources: discovered.map(source => Object.assign(source, { enabled: true })) }) })
			assert.ok(subscription instanceof IcsSubscription)
			assert.equal(subscription.sources.length, 1)
			assert.equal(subscription.sources[0]!.enabled, true)

			const sourceId = subscription.sources[0]!.id
			await until(async () => await entriesIn(sourceId) === 2)
			await until(async () => {
				await shown()
				return !!Calendars.sources.find(source => source.id === sourceId)?.importedAt
			})
		})

		it('edits the choice of calendars, and edits it again at once from what the save answered', async () => {
			await shown()
			const listed = Calendars.integrations.find(integration => integration.id === subscription.id)!
			const turnedOff = listed.clone()
			turnedOff.sources.forEach(source => source.enabled = false)
			const saved = await UpdateIntegration.call({ id: turnedOff.id, integration: turnedOff })
			assert.deepEqual(saved.sources.map(source => source.enabled), [false])

			const again = saved.clone()
			assert.deepEqual(again.sources.map(source => source.enabled), [false])
			again.sources.forEach(source => source.enabled = true)
			const savedAgain = await UpdateIntegration.call({ id: again.id, integration: again })
			assert.deepEqual(savedAgain.sources.map(source => source.enabled), [true])

			await shown()
			assert.deepEqual(Calendars.sources.filter(source => source.integrationId === subscription.id).map(source => [source.name, source.enabled]), savedAgain.sources.map(source => [source.name, true]))
		})

		it('keeps one calendar for the feed however often it is edited', async () => {
			await shown()
			assert.equal(Calendars.sources.filter(source => source.integrationId === subscription.id).length, 1)
		})

		it('re-imports, reading the feed afresh', async () => {
			feedBody = feedOf(['Retro', 'Offsite', 'Party'])
			await ReimportIntegration.call({ id: subscription.id })
			await until(async () => await entriesIn(subscription.sources[0]!.id) === 3)
		})

		it('keeps the integrations in the order they were put in', async () => {
			await shown()
			const reversed = [...Calendars.integrations].reverse().map(integration => integration.id)
			await ReorderIntegrations.call({ ids: reversed })
			await shown()
			assert.deepEqual(Calendars.integrations.map(integration => integration.id), reversed)
		})

		it('disconnects, its calendars and their entries going with it', async () => {
			const sourceId = subscription.sources[0]!.id
			await DisconnectIntegration.call({ id: subscription.id })
			assert.deepEqual(await shown(), [{ type: 'mitra', calendars: [...mitra().sources].map(source => source.name) }])
			assert.equal(await entriesIn(sourceId), 0)
		})
	})

	describe('two accounts', () => {
		it('never see each other\'s integrations or calendars', async () => {
			current = stranger
			try {
				assert.deepEqual(await shown(), [{ type: 'mitra', calendars: ['Private'] }])
			} finally {
				current = owner
			}
			assert.ok(!(await shown()).some(integration => integration.calendars.includes('Private')))
		})

		it('cannot rename another account\'s calendar', async () => {
			current = stranger
			await shown()
			const theirs = calendar('Private').id
			current = owner
			await assert.rejects(() => RenameSource.call({ id: theirs, name: 'Taken' }))
			current = stranger
			try {
				await shown()
				assert.equal(calendar('Private').name, 'Private')
			} finally {
				current = owner
			}
		})
	})
})
