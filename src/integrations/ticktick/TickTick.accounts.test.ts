import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { Api } from '@a11d/api'
import { DateTime } from '@3mo/date-time'
import '@3mo/date-time-value-constructor'
import { ModelValueConstructor } from '@a11d/api-model-value-constructor'
import { Entry, EntryType, TaskStatus, EntryPatch } from '#features/entries'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { User } from '#features/identity'
import { EntryRelations, RelationType } from '#features/relations'
import { Color, Source } from '#features/sources'
import { CreateEntry } from '#features/entries/server/CreateEntry.ts'
import { UpdateEntry } from '#features/entries/server/UpdateEntry.ts'
import { DeleteEntry } from '#features/entries/server/DeleteEntry.ts'
import { ListAllEntries } from '#features/entries/server/ListAllEntries.ts'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.ts'
import { Integration } from '#integrations'
import { ConnectIntegration } from '#integrations/server/ConnectIntegration.ts'
import { DisconnectIntegration } from '#integrations/server/DisconnectIntegration.ts'
import { DiscoverSources } from '#integrations/server/DiscoverSources.ts'
import { ReimportIntegration } from '#integrations/server/ReimportIntegration.ts'
import { HttpRecording } from '#infrastructure/http/HttpRecording.testing.ts'
import { TickTick, type TickTickProject, type TickTickTask } from './TickTick.ts'
import { TickTickClient } from './server/TickTickClient.ts'

/*
	A TickTick account end to end as TickTick answers it: discovery, connecting, the import, every kind of date, checklists,
	subtasks and statuses, Mitra's writes landing in TickTick, changes made in TickTick read back by the next sync, moves,
	deletions, a re-import, and disconnecting. Each recording in recordings/ replays what TickTick answered when it was made;
	a request TickTick never answered fails it. Record one again with the plan and the API token (TickTick: Settings →
	Account → API Keys) of an account on that plan with three lists to spare (a free one holds nine):

		MITRA_TEST_TICKTICK=free=<token> npm run record:ticktick

	The test makes its own lists and leaves the account as it found it, so a recording depends on nothing the account holds.
*/

const recordings = `${process.cwd()}/src/integrations/ticktick/recordings`
// `<plan>=<token>`: the recording to make, and the API token of an account on that plan.
const [recorded, token] = process.env.MITRA_TEST_TICKTICK?.split(/=(.*)/) ?? []
const names = [...new Set([...existsSync(recordings) ? readdirSync(recordings).filter(file => file.endsWith('.json')).map(file => file.slice(0, -'.json'.length)) : [], ...recorded ? [recorded] : []])].sort()

const TICKTICK = 'https://api.ticktick.com'
const HOME = 'Mitra Home'
const ERRANDS = 'Mitra Errands'
const NOTES = 'Mitra Notes'
const TAG = 'mitra-bills'
/** The lists the steps make; the account may have others of its own. */
const ours = <T extends { name: string }>(sources: ReadonlyArray<T>) => sources.filter(source => source.name.startsWith('Mitra '))
/** Every name and text the steps write; whatever else the account holds stays out of the recording. */
const written = new Set([
	'Inbox', HOME, ERRANDS, NOTES, TAG, 'Pay rent', 'Pay the rent', 'Call the plumber', 'Standup', 'Standup, moved', 'Water the plants',
	'Buy groceries', 'From the **market**', 'Oat milk', 'Bread', 'Paint the hallway', 'Pick a color', 'Fetch the parcel', 'Old chore', 'Skip the gym',
	'See the dentist', 'Inbox idea', 'A note', 'Plain text', 'Plan the week', 'Look **ahead**', 'Call the bank', 'Return the books', 'Retro',
])
const foreign = (body: string) => {
	try {
		return JSON.stringify(JSON.parse(body), (key, value: unknown) => ['title', 'name', 'content', 'desc'].includes(key) && typeof value === 'string' && value && !written.has(value) ? '{secret}' : value)
	} catch {
		return body
	}
}

/** TickTick's answers keep the account's identity out of the recording: replay meets these instead. */
const stand = { email: 'owner@example.com', apiToken: 'replay-token' }

const iso = (value: unknown) => (value as Date | undefined)?.toISOString()

describe('A TickTick account as TickTick answers it', () => {
	let app: Server
	let user: User
	let entriesIn: (sourceId: string) => Promise<Array<{ id: string, heading: string, status: string }>>
	let imported: (integrationId: string) => Promise<boolean>
	let persist: (...entities: Array<object>) => Promise<void>
	let syncNow: (integrationId: string) => Promise<void>
	let closeOrm: () => Promise<void>
	let apiToken = ''

	before(async () => {
		// Mitra writes a time in the zone of the device that made it: every run, the recording's included, is in one zone.
		process.env.TZ = 'Europe/Berlin'
		const { orm } = await import('#infrastructure/database/orm.ts')
		await import('#integrations/server/registerEngines.ts')
		const { staleTabs } = await import('#features/entries/server/staleTabs.ts')
		const { operationsRouter } = await import('#infrastructure/operations/server/operationsRouter.ts')
		await import('#app/operations.ts')

		const connection = orm.em.getConnection()
		entriesIn = sourceId => connection.execute('select id, heading, status from entry where source_id = ?', [sourceId])
		// The importer reads one list after another in the background: a step goes on once every enabled one is in.
		imported = async integrationId => !(await connection.execute('select id from source where integration_id = ? and enabled = 1 and imported_at is null', [integrationId])).length
		persist = async (...entities) => {
			const em = orm.em.fork()
			em.persist(entities)
			await em.flush()
		}
		// What the background sync does each cycle: discovery, then every enabled list read whole.
		syncNow = async integrationId => {
			const em = orm.em.fork()
			await (await em.findOneOrFail(Integration, { id: integrationId })).sync(em)
		}
		closeOrm = () => orm.close()

		const models = new ModelValueConstructor()
		const routes = express()
		routes.use((req, _res, next) => {
			req.user = user
			next()
		})
		routes.use(express.json({ reviver: (_key, value) => models.shallConstruct(value) ? models.construct(value) : value }))
		routes.use('/api/entries', staleTabs)
		routes.use('/api', operationsRouter(() => orm.em.fork()))
		app = await new Promise<Server>(resolve => {
			const listening = routes.listen(0, () => resolve(listening))
		})
		Api.url = `http://localhost:${(app.address() as AddressInfo).port}/api`
		// @a11d/api sets `referrer: 'no-referrer'`, which Node's fetch refuses. And this process is built as the server, whose
		// `withheld` blanks the token a browser sends: it goes back on the request.
		const browserFetch = globalThis.fetch
		globalThis.fetch = (input, init) => browserFetch(input, {
			...init,
			referrer: undefined,
			body: typeof init?.body === 'string' && String(input instanceof Request ? input.url : input).startsWith(Api.url)
				? init.body.replaceAll('"token":""', `"token":${JSON.stringify(apiToken)}`)
				: init?.body,
		})
	})

	after(async () => {
		if (app) {
			await new Promise(resolve => app.close(resolve))
			await closeOrm()
		}
	})

	for (const name of names) {
		let placeholders: Record<string, string> = {}
		const recording = new HttpRecording(`${recordings}/${name}.json`, () => placeholders, {
			// TickTick's ids are 24 hex digits, quoted or in a path, the inbox's its digits after `inbox`; an etag is TickTick's own.
			// A recording keeps them made up in letters of any kind, so they are found as letters and digits.
			tokens: [/(?<=inbox)\d+/g, /(?<=")[0-9a-z]{24}(?=")/g, /(?<=\/)[0-9a-z]{24}(?=[/?]|$)/g, /(?<="etag":\s*")[^"]+(?=")/g],
			times: [/(?<="(?:completedTime|modifiedTime|createdTime)":\s*")[^"]+(?=")/g],
			// The completions are asked for up to now, a window written with milliseconds as no task's own date is.
			stamps: [/(?<="(?:startDate|endDate)":\s*")\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+0000(?=")/g],
			// The members of a list other than the account, whose address is already its placeholder.
			secrets: [/(?<="(?:username|displayName|assigneeUsername)":\s*")(?!\{email\})[^"]*(?=")/g],
			// The account's own lists and tasks show in every list it reads; the recording keeps them nameless.
			redact: foreign,
		})
		const live = name === recorded && !!token
		describe(name, () => {
			let api: string
			let stop: () => Promise<void>
			let unrecorded: () => ReadonlyArray<string> = () => []
			let local: Source
			let integration: TickTick
			const calendar = (calendarName: string) => integration.sources.find(source => source.name === calendarName)!
			const home = () => calendar(HOME)
			const errands = () => calendar(ERRANDS)

			/** TickTick itself, as its own app reads and writes it. */
			const call = async <T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown) => {
				const response = await fetch(`${api}${path}`, {
					method,
					headers: { authorization: `Bearer ${apiToken}`, ...body === undefined ? {} : { 'content-type': 'application/json' } },
					body: body === undefined ? undefined : JSON.stringify(body),
				})
				const text = await response.text()
				return { status: response.status, body: (text ? JSON.parse(text) : {}) as T }
			}
			const lists: Record<string, string> = {}
			const ids: Record<string, string> = {}
			/** Where each task TickTick made lives, the inbox's by its real id. */
			const projects: Record<string, string> = {}
			const add = async (key: string, init: Record<string, unknown> & { title: string, projectId: string }) => {
				const { status, body } = await call<TickTickTask>('POST', 'task', init)
				assert.equal(status, 200, `TickTick refused ${init.title}`)
				ids[key] = body.id
				projects[key] = body.projectId
				return body
			}
			const taskOf = async (key: string, projectId = lists.home!) => (await call<TickTickTask>('GET', `project/${projectId}/task/${ids[key]}`)).body
			const headings = async (sourceId: string) => (await entriesIn(sourceId)).map(entry => entry.heading).sort()
			const entryOf = async (heading: string) => (await ListAllEntries.call()).find(entry => entry.heading === heading)!

			const until = async (condition: () => Promise<boolean>, ms = 60_000) => {
				const deadline = Date.now() + ms
				while (!await condition()) {
					if (Date.now() > deadline) {
						throw new Error('Timed out')
					}
					await new Promise(resolve => setTimeout(resolve, 150))
				}
			}

			before(async () => {
				if (live) {
					apiToken = token!
					// Who the account is, asked past the recording: its address becomes a placeholder before TickTick names it there.
					const direct = async <T>(method: string, path: string, body?: unknown) => await (await fetch(`${TICKTICK}/open/v1/${path}`, {
						method,
						headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
						body: body === undefined ? undefined : JSON.stringify(body),
					})).json() as T
					const existing = await direct<Array<TickTickProject>>('GET', 'project')
					const probe = existing[0] ?? await direct<TickTickProject>('POST', 'project', { name: 'Mitra Identity' })
					const members = await direct<Array<{ username: string, self: boolean }>>('GET', `project/${probe.id}/members`)
					if (!existing[0]) {
						await fetch(`${TICKTICK}/open/v1/project/${probe.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${apiToken}` } })
					}
					placeholders = { email: members.find(member => member.self)!.username, apiToken }
					// A second between requests keeps the account well inside what TickTick allows, which it does not say.
					const proxy = await recording.record(TICKTICK, undefined, 1000)
					api = `${proxy.origin}/open/v1/`
					stop = proxy.close
				} else {
					apiToken = stand.apiToken
					placeholders = { ...stand }
					const replay = await recording.replay()
					api = `${replay.origin}/open/v1/`
					stop = replay.close
					unrecorded = () => replay.unrecorded
				}
				TickTickClient.baseUrl = api

				// A run that failed left its lists behind, which a free account has room for only so many of.
				const { body: leftover } = await call<Array<TickTickProject>>('GET', 'project')
				for (const project of ours(leftover)) {
					await call('DELETE', `project/${project.id}`)
				}

				// Made as TickTick's app makes them, with what Mitra must read and what it must leave alone (priority, tags, the repeat).
				for (const [key, init] of Object.entries({ home: { name: HOME, color: '#F18181', kind: 'TASK' }, errands: { name: ERRANDS, kind: 'TASK' }, notes: { name: NOTES, kind: 'NOTE' } })) {
					const { status, body } = await call<TickTickProject>('POST', 'project', init)
					assert.equal(status, 200, `TickTick refused the list ${init.name}: a free account holds nine`)
					lists[key] = body.id
				}
				const projectId = lists.home!
				await add('rent', { projectId, title: 'Pay rent', isAllDay: true, startDate: '2026-11-01T23:00:00+0000', dueDate: '2026-11-01T23:00:00+0000', timeZone: 'Europe/Berlin', priority: 5, tags: [TAG] })
				await add('plumber', { projectId, title: 'Call the plumber', isAllDay: false, isFloating: true, startDate: '2026-11-03T15:00:00+0000', dueDate: '2026-11-03T15:00:00+0000', timeZone: 'Europe/Berlin' })
				await add('standup', { projectId, title: 'Standup', isAllDay: false, startDate: '2026-11-04T14:00:00+0000', dueDate: '2026-11-04T14:00:00+0000', timeZone: 'America/New_York' })
				await add('water', { projectId, title: 'Water the plants', isAllDay: false, startDate: '2026-11-02T08:00:00+0000', dueDate: '2026-11-02T08:00:00+0000', timeZone: 'Europe/Berlin', repeatFlag: 'RRULE:FREQ=WEEKLY;BYDAY=MO', repeatFrom: '2' })
				await add('dentist', { projectId, title: 'See the dentist', isAllDay: false, startDate: '2026-11-06T09:00:00+0000', dueDate: '2026-11-06T09:00:00+0000', timeZone: 'Europe/Berlin', reminders: ['TRIGGER:PT0S', 'TRIGGER:-PT15M'] })
				await add('groceries', { projectId, title: 'Buy groceries', kind: 'CHECKLIST', desc: 'From the **market**', items: [{ title: 'Oat milk', status: 0 }, { title: 'Bread', status: 1 }] })
				await add('hallway', { projectId, title: 'Paint the hallway' })
				await add('color', { projectId, title: 'Pick a color', parentId: ids.hallway })
				await add('chore', { projectId, title: 'Old chore' })
				await add('gym', { projectId, title: 'Skip the gym' })
				await add('parcel', { projectId: lists.errands!, title: 'Fetch the parcel' })
				await add('idea', { projectId: 'inbox', title: 'Inbox idea' })
				await add('note', { projectId: lists.notes!, title: 'A note', content: 'Plain text', kind: 'NOTE' })
				await call('POST', `project/${projectId}/task/${ids.chore}/complete`)
				await call('POST', `task/${ids.gym}`, { id: ids.gym, projectId, status: -1 })

				user = new User({ username: `ticktick-${name}` })
				const mitra = new MitraCalendar({ userId: user.id, uri: MitraCalendar.uri })
				local = new Source({ integrationId: mitra.id, uri: MitraCalendar.sourceUri('local'), name: 'Local', entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false })
				await persist(user, mitra, local)
			})

			after(async () => {
				await stop?.()
			})

			const credentials = () => ({ username: '', token: apiToken, timeZone: '' })

			it('discovers the inbox first, then the task lists, all turned off, and no note list', async () => {
				const discovered = await DiscoverSources.call({ integration: new TickTick({ credentials: credentials() }) })
				assert.equal(discovered[0]!.name, 'Inbox')
				assert.deepEqual(ours(discovered).map(source => source.name).sort(), [ERRANDS, HOME])
				assert.ok(discovered.every(source => source instanceof Source && !source.enabled))
				assert.equal(discovered.find(source => source.name === HOME)!.color, Color.parse('#F18181'), 'the color picked in TickTick')
			})

			it('connects with the lists chosen, learning the account and its zone, and imports only their tasks', async () => {
				const discovered = await DiscoverSources.call({ integration: new TickTick({ credentials: credentials() }) })
				integration = await ConnectIntegration.call({ integration: new TickTick({ credentials: credentials(), sources: discovered.map(source => Object.assign(source, { enabled: source.name.startsWith('Mitra ') })) }) }) as TickTick
				assert.equal(integration.uri, TickTick.accountUri(placeholders.email!))
				assert.deepEqual([integration.credentials.username, integration.credentials.timeZone], [placeholders.email, 'Europe/Berlin'])

				const expected = ['Buy groceries', 'Call the plumber', 'Old chore', 'Paint the hallway', 'Pay rent', 'Pick a color', 'See the dentist', 'Skip the gym', 'Standup', 'Water the plants']
				await until(() => imported(integration.id))
				assert.deepEqual(await headings(home().id), expected)
				assert.deepEqual(await headings(errands().id), ['Fetch the parcel'])
				assert.deepEqual(await headings(calendar('Inbox').id), [], 'a list left off stays out')
			})

			it('reads each kind of date as Mitra holds it: a day, a floating time, a time fixed in a zone, a repeat at its next date', async () => {
				const rent = await entryOf('Pay rent')
				assert.deepEqual([rent.allDay, iso(rent.start), iso(rent.end)], [true, '2026-11-02T00:00:00.000Z', '2026-11-03T00:00:00.000Z'])

				const plumber = await entryOf('Call the plumber')
				assert.deepEqual([plumber.allDay, plumber.timeZone?.floating, iso(plumber.start), plumber.end], [false, true, '2026-11-03T16:00:00.000Z', undefined])

				const standup = await entryOf('Standup')
				assert.deepEqual([standup.timeZone?.id, iso(standup.start)], ['America/New_York', '2026-11-04T14:00:00.000Z'])

				const water = await entryOf('Water the plants')
				assert.equal(water.recurrence, undefined, 'the repeat stays TickTick\'s')
				assert.equal(iso(water.start), '2026-11-02T08:00:00.000Z')
			})

			it('reads a checklist into the description, subtasks, reminders, and done and won\'t-do tasks', async () => {
				assert.equal((await entryOf('Buy groceries')).description, 'From the **market**\n\n- [ ] Oat milk\n- [x] Bread')
				const color = await entryOf('Pick a color')
				assert.deepEqual(color.relations?.writes.map(relation => [relation.type, relation.targetUid]), [[RelationType.Parent, ids.hallway]])
				assert.deepEqual([...(await entryOf('See the dentist')).reminders ?? []], [0, 15])
				assert.equal((await entryOf('Old chore')).status, TaskStatus.Done)
				assert.equal((await entryOf('Skip the gym')).status, TaskStatus.Cancelled)
			})

			it('writes a task made in Mitra into its list', async () => {
				const start = new DateTime('2026-11-06T10:00:00Z')
				const created = await CreateEntry.call(EntryPatch.creating(new Entry({
					sourceId: home().id, type: EntryType.Task, heading: 'Plan the week', description: 'Look **ahead**',
					start, timeZone: EntryTimeZone.floating,
				})))
				ids.week = created.uri!
				const upstream = await taskOf('week')
				assert.deepEqual([upstream.title, upstream.content, upstream.projectId], ['Plan the week', 'Look **ahead**', lists.home])
				assert.deepEqual([upstream.isFloating, upstream.startDate, upstream.dueDate], [true, '2026-11-06T09:00:00.000+0000', '2026-11-06T09:00:00.000+0000'], 'ten on a Berlin clock, floating')
				assert.equal(iso(created.start), '2026-11-06T10:00:00.000Z')
			})

			it('writes an edit as only what changed, leaving priority and tags as TickTick has them', async () => {
				const rent = await entryOf('Pay rent')
				rent.heading = 'Pay the rent'
				await UpdateEntry.call({ ...EntryPatch.of(rent, ['heading']), id: rent.id! })
				const upstream = await taskOf('rent')
				assert.deepEqual([upstream.title, upstream.priority, upstream.tags], ['Pay the rent', 5, [TAG]])
			})

			it('moves a date between a day, a time fixed in a zone and none', async () => {
				const rent = await entryOf('Pay the rent')
				Object.assign(rent, { allDay: false, start: new DateTime('2026-11-02T08:00:00Z'), end: undefined, timeZone: EntryTimeZone.parse('Europe/Madrid') })
				await UpdateEntry.call({ ...EntryPatch.of(rent, ['start', 'end', 'allDay', 'timeZone']), id: rent.id! })
				const fixed = await taskOf('rent')
				assert.deepEqual([fixed.isAllDay, fixed.startDate, fixed.timeZone], [false, '2026-11-02T08:00:00.000+0000', 'Europe/Madrid'])

				const plumber = await entryOf('Call the plumber')
				Object.assign(plumber, { allDay: true, start: new DateTime('2026-11-04T00:00:00Z'), end: new DateTime('2026-11-05T00:00:00Z'), timeZone: undefined })
				await UpdateEntry.call({ ...EntryPatch.of(plumber, ['start', 'end', 'allDay', 'timeZone']), id: plumber.id! })
				const day = await taskOf('plumber')
				assert.deepEqual([day.isAllDay, day.startDate], [true, '2026-11-03T23:00:00.000+0000'])
				assert.deepEqual([(await entryOf('Call the plumber')).allDay, iso((await entryOf('Call the plumber')).start)], [true, '2026-11-04T00:00:00.000Z'])

				const dentist = await entryOf('See the dentist')
				Object.assign(dentist, { start: undefined, end: undefined, reminders: undefined })
				await UpdateEntry.call({ ...EntryPatch.of(dentist, ['start', 'end', 'reminders']), id: dentist.id! })
				assert.equal((await taskOf('dentist')).startDate, undefined)
				assert.equal((await entryOf('See the dentist')).start, undefined)
			})

			it('moves a repeating task\'s next date, keeping its rule', async () => {
				const water = await entryOf('Water the plants')
				water.start = water.start!.add({ days: 1 })
				await UpdateEntry.call({ ...EntryPatch.of(water, ['start', 'end']), id: water.id! })
				const upstream = await taskOf('water')
				assert.deepEqual([upstream.repeatFlag, upstream.startDate], ['RRULE:FREQ=WEEKLY;BYDAY=MO', '2026-11-03T08:00:00.000+0000'])
			})

			it('completes a task, opens it again, and gives it up', async () => {
				const standup = await entryOf('Standup')
				standup.status = TaskStatus.Done
				await UpdateEntry.call({ ...EntryPatch.of(standup, ['status']), id: standup.id! })
				assert.equal((await taskOf('standup')).status, 2)

				standup.status = TaskStatus.ToDo
				await UpdateEntry.call({ ...EntryPatch.of(standup, ['status']), id: standup.id! })
				assert.equal((await taskOf('standup')).status, 0)

				standup.status = TaskStatus.Cancelled
				await UpdateEntry.call({ ...EntryPatch.of(standup, ['status']), id: standup.id! })
				assert.equal((await taskOf('standup')).status, -1)
				standup.status = TaskStatus.ToDo
				await UpdateEntry.call({ ...EntryPatch.of(standup, ['status']), id: standup.id! })
			})

			it('completes a repeating task as TickTick does: it moves on to its next date, open', async () => {
				const water = await entryOf('Water the plants')
				const before = water.start!
				water.status = TaskStatus.Done
				const saved = await UpdateEntry.call({ ...EntryPatch.of(water, ['status']), id: water.id! })
				const upstream = await taskOf('water')
				assert.equal(saved.status, TaskStatus.ToDo)
				assert.equal(iso(saved.start), TickTick.instantOf(upstream.startDate)!.toISOString())
				assert.ok(saved.start!.valueOf() > before.valueOf(), 'its next date')
				assert.equal(upstream.repeatFlag, 'RRULE:FREQ=WEEKLY;BYDAY=MO')
			})

			it('ticks a checklist item by its checkbox in the description', async () => {
				const groceries = await entryOf('Buy groceries')
				groceries.description = 'From the **market**\n\n- [x] Oat milk\n- [x] Bread'
				await UpdateEntry.call({ ...EntryPatch.of(groceries, ['description']), id: groceries.id! })
				const upstream = await taskOf('groceries')
				assert.deepEqual([upstream.desc, upstream.items?.map(item => [item.title, item.status])], ['From the **market**', [['Oat milk', 1], ['Bread', 1]]])
			})

			it('makes a task a subtask of another and lets it go again', async () => {
				const groceries = await entryOf('Buy groceries')
				groceries.relateTo(RelationType.Parent, ids.hallway!)
				await UpdateEntry.call({ ...EntryPatch.of(groceries, ['relations']), id: groceries.id! })
				assert.equal((await taskOf('groceries')).parentId, ids.hallway)

				const freed = await entryOf('Buy groceries')
				freed.relations = EntryRelations.none
				await UpdateEntry.call({ ...EntryPatch.of(freed, ['relations']), id: freed.id! })
				assert.equal((await taskOf('groceries')).parentId, undefined)
			})

			it('moves a task to another list in place', async () => {
				const week = await entryOf('Plan the week')
				week.sourceId = errands().id
				await UpdateEntry.call({ ...EntryPatch.of(week, ['sourceId']), id: week.id! })
				assert.equal((await taskOf('week', lists.errands)).projectId, lists.errands)
				const moved = await entryOf('Plan the week')
				assert.deepEqual([moved.id, moved.sourceId], [week.id, errands().id], 'the same entry')
			})

			it('reads what changed in TickTick with the next sync: an edit, a completion, a deletion, a move and a new task', async () => {
				const projectId = lists.home!
				await call('POST', `task/${ids.standup}`, { id: ids.standup, projectId, title: 'Standup, moved', isAllDay: false, startDate: '2026-11-04T15:00:00+0000', dueDate: '2026-11-04T15:00:00+0000', timeZone: 'America/New_York' })
				await call('POST', `project/${projectId}/task/${ids.color}/complete`)
				await call('DELETE', `project/${projectId}/task/${ids.chore}`)
				await call('POST', 'task/move', [{ fromProjectId: projectId, toProjectId: lists.errands, taskId: ids.groceries }])
				await add('bank', { projectId, title: 'Call the bank' })
				await syncNow(integration.id)

				assert.deepEqual(await headings(errands().id), ['Buy groceries', 'Fetch the parcel', 'Plan the week'])
				const homeNow = await headings(home().id)
				assert.ok(homeNow.includes('Call the bank') && homeNow.includes('Standup, moved') && !homeNow.includes('Standup'))
				assert.equal(iso((await entryOf('Standup, moved')).start), '2026-11-04T15:00:00.000Z')
				assert.equal((await entryOf('Pick a color')).status, TaskStatus.Done)
			})

			it('creates a task that is already done', async () => {
				const done = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: home().id, type: EntryType.Task, heading: 'Return the books', status: TaskStatus.Done })))
				assert.equal(done.status, TaskStatus.Done)
				ids.books = done.uri!
				assert.equal((await taskOf('books')).status, 2)
			})

			it('moves an entry from a calendar Mitra keeps into a list', async () => {
				const kept = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: local.id, type: EntryType.Task, heading: 'Retro' })))
				kept.sourceId = home().id
				await UpdateEntry.call({ ...EntryPatch.of(kept, ['sourceId']), id: kept.id! })
				assert.deepEqual(await headings(local.id), [])
				ids.retro = (await entryOf('Retro')).uri!
				assert.equal((await taskOf('retro')).projectId, lists.home)
			})

			it('deletes a task in TickTick, and takes one TickTick no longer has as deleted', async () => {
				await DeleteEntry.call({ id: (await entryOf('Retro')).id! })
				assert.ok(!(await call<{ tasks: Array<TickTickTask> }>('GET', `project/${lists.home}/data`)).body.tasks.some(task => task.title === 'Retro'))
				assert.ok(!(await headings(home().id)).includes('Retro'))

				await call('DELETE', `project/${lists.home}/task/${ids.bank}`)
				await DeleteEntry.call({ id: (await entryOf('Call the bank')).id! })
				assert.ok(!(await headings(home().id)).includes('Call the bank'))
			})

			it('imports again from scratch, the done tasks of the last weeks included', async () => {
				await ReimportIntegration.call({ id: integration.id })
				await until(() => imported(integration.id))
				const done = new Set((await entriesIn(home().id)).filter(entry => entry.status === TaskStatus.Done.code).map(entry => entry.heading))
				assert.ok(['Pick a color', 'Return the books', 'Water the plants'].every(heading => done.has(heading)), 'a repeating task\'s completion is kept apart')
				assert.ok(!(await headings(home().id)).includes('Old chore'), 'a deleted task stays gone')
				assert.ok((await headings(home().id)).includes('Skip the gym'), 'a task given up comes along')
			})

			it('disconnects, leaving the lists as they are', async () => {
				const homeId = home().id
				await DisconnectIntegration.call({ id: integration.id })
				assert.deepEqual(await entriesIn(homeId), [])
				const { body } = await call<{ tasks: Array<TickTickTask> }>('GET', `project/${lists.home}/data`)
				assert.ok(body.tasks.some(task => task.title === 'Pay the rent'))
			})

			it('leaves the account as it found it', async () => {
				await call('DELETE', `project/${projects.idea}/task/${ids.idea}`)
				for (const id of Object.values(lists)) {
					assert.equal((await call('DELETE', `project/${id}`)).status, 200)
				}
			})

			it('asked TickTick only what it answered when the recording was made', () => {
				assert.deepEqual(unrecorded(), [], 'Mitra asks TickTick something new since the recording: record again (see above)')
			})
		})
	}
})
