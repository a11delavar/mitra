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
import { ListIntegrations } from '#integrations/server/ListIntegrations.ts'
import { ConnectIntegration } from '#integrations/server/ConnectIntegration.ts'
import { DisconnectIntegration } from '#integrations/server/DisconnectIntegration.ts'
import { DiscoverSources } from '#integrations/server/DiscoverSources.ts'
import { ReimportIntegration } from '#integrations/server/ReimportIntegration.ts'
import { HttpRecording } from '#infrastructure/http/HttpRecording.testing.ts'
import { Todoist, type TodoistDue, type TodoistTask } from './Todoist.ts'
import { TodoistClient } from './server/TodoistClient.ts'

/*
	A Todoist account end to end as Todoist answers it: discovery, connecting, the import, every kind of date, Mitra's writes
	landing in Todoist, changes made in Todoist read back by the next sync, moves, deletions, an archived project, a re-import,
	and disconnecting. The same steps run once per recording in recordings/, a Free account's and a Pro one's, which differ in
	what their plan holds (deadlines, durations). Each replays what Todoist answered when it was made; a request Todoist never
	answered fails it. Record one again with the plan and the API token (Todoist: Settings → Integrations → Developer) of
	an account on that plan:

		MITRA_TEST_TODOIST=free=<token> npm run record:todoist

	The test makes its own projects and leaves the account as it found it, so a recording depends on nothing the account holds.
*/

const recordings = `${process.cwd()}/src/integrations/todoist/recordings`
// `<plan>=<token>`: the recording to make, and the API token of an account on that plan.
const [recorded, token] = process.env.MITRA_TEST_TODOIST?.split(/=(.*)/) ?? []
const names = [...new Set([...existsSync(recordings) ? readdirSync(recordings).filter(file => file.endsWith('.json')).map(file => file.slice(0, -'.json'.length)) : [], ...recorded ? [recorded] : []])].sort()

const TODOIST = 'https://api.todoist.com'
const HOME = 'Mitra Home'
const ERRANDS = 'Errands'
const LABEL = 'mitra-bills'
/** The calendars the steps make; the account has others of its own. */
const ours = <T extends { name: string }>(sources: ReadonlyArray<T>) => sources.filter(source => source.name.startsWith(HOME))
/** Every name and text the steps write; whatever else the account holds stays out of the recording. */
const written = new Set([
	'Inbox', HOME, ERRANDS, LABEL, 'Pay rent', 'Pay the rent', 'Call the plumber', 'Standup', 'Standup, moved', 'Water the plants',
	'Buy groceries', 'From the **market**\n\n- [ ] oat milk\n- [x] bread', 'Paint the hallway', 'Pick a color', 'Fetch the parcel', 'Old chore',
	'File taxes', 'Workshop', 'Write the report', 'Trip', 'Plan the week', 'Look **ahead**', 'Never written', 'Call the bank', 'Return the books', 'Retro',
])
const foreign = (body: string) => {
	try {
		return JSON.stringify(JSON.parse(body), (key, value: unknown) => ['content', 'description', 'name'].includes(key) && typeof value === 'string' && value && !written.has(value) ? '{secret}' : value)
	} catch {
		return body
	}
}

/** Todoist's answers keep the account's identity out of the recording: replay meets these instead. */
const stand = { account: 'account-1', email: 'owner@example.com', name: 'Owner', apiToken: 'replay-token' }

const iso = (value: unknown) => (value as Date | undefined)?.toISOString()
/** A due date's instant, its wall clock read as UTC where it floats, as Mitra keeps floating times. */
const instantOf = (due: TodoistDue) => due.date.length === 10
	? `${due.date}T00:00:00.000Z`
	: /(?:Z|[+-]\d{2}:?\d{2})$/.test(due.date)
		? new Date(Temporal.Instant.from(due.date).epochMilliseconds).toISOString()
		: `${Temporal.PlainDateTime.from(due.date).toString({ smallestUnit: 'millisecond' })}Z`

describe('A Todoist account as Todoist answers it', () => {
	let app: Server
	let user: User
	let entriesIn: (sourceId: string) => Promise<Array<{ id: string, heading: string, status: string }>>
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
		persist = async (...entities) => {
			const em = orm.em.fork()
			em.persist(entities)
			await em.flush()
		}
		// What the background sync does each cycle: discovery, then what changed since the last read.
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
			// Todoist's ids, its sync tokens and a project's public key are its own, handed back as they came.
			// Ids are 16 letters and digits, quoted, in a path or in a query; a label's is a quoted number.
			tokens: [/(?<="sync_token":\s*")[^"*]+(?=")/g, /(?<="public_key":\s*")[^"]+(?=")/g, /(?<=")[0-9A-Za-z]{16}(?=")/g, /(?<=\/tasks\/)[0-9A-Za-z]{16}/g, /(?<=[?&]\w+_id=)[0-9A-Za-z]{16}/g, /(?<=")\d{9,}(?=")/g],
			times: [/(?<="\w+_at":\s*")[^"]+(?=")/g],
			// The completed list is asked for the weeks up to now.
			stamps: [/(?<=[?&](?:since|until)=)[^&]+/g],
			// The account's profile carries its API token and addresses holding tokens of their own.
			secrets: [/(?<="(?:token|websocket_url|feature_identifier|image_id|avatar_\w+)":\s*")[^"]*(?=")/g],
			// The account's own projects, labels and tasks show in every full read; the recording keeps them nameless.
			redact: foreign,
		})
		const live = name === recorded && !!token
		describe(name, () => {
			let api: string
			let stop: () => Promise<void>
			let unrecorded: () => ReadonlyArray<string> = () => []
			let local: Source
			let integration: Todoist
			const calendar = (calendarName: string) => integration.sources.find(source => source.name === calendarName)!
			const home = () => calendar(HOME)
			const errands = () => calendar(`${HOME} · ${ERRANDS}`)

			/** Todoist itself, as its own app reads and writes it. */
			const call = async <T>(path: string, body?: object) => {
				const response = await fetch(`${api}${path}`, {
					method: body ? 'POST' : 'GET',
					headers: { authorization: `Bearer ${apiToken}`, ...body ? { 'content-type': 'application/json' } : {} },
					body: body ? JSON.stringify(body) : undefined,
				})
				return { status: response.status, body: (response.status === 204 ? {} : await response.json()) as T }
			}
			/** Runs commands as the Todoist app does, each by its own `uuid`. @returns what each was answered, and the ids Todoist gave the temporary ones. */
			const run = async (...commands: Array<{ type: string, args: object, temp_id?: string }>) => {
				const stamped = commands.map(command => ({ uuid: crypto.randomUUID(), ...command }))
				const { body } = await call<{ sync_status: Record<string, unknown>, temp_id_mapping: Record<string, string> }>('sync', { commands: stamped })
				return { statuses: stamped.map(command => body.sync_status[command.uuid]), ids: body.temp_id_mapping }
			}
			const commands = async (...each: Array<{ type: string, args: object, temp_id?: string }>) => {
				const { statuses, ids } = await run(...each)
				assert.deepEqual(statuses, each.map(() => 'ok'), `Todoist refused: ${JSON.stringify(statuses)}`)
				return ids
			}
			const taskOf = async (id: string) => (await call<TodoistTask>(`tasks/${id}`)).body
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

			// What the plan holds, named by the recording, which the account it is made with must be on.
			const pro = name === 'pro'
			const ids: Record<string, string> = {}

			before(async () => {
				if (live) {
					apiToken = token!
					// Who the account is, asked past the recording: its identity becomes placeholders before Todoist names it there.
					const profile = await fetch(`${TODOIST}/api/v1/sync`, {
						method: 'POST',
						headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
						body: JSON.stringify({ sync_token: '*', resource_types: ['user'] }),
					})
					const { user: account } = await profile.json() as { user: { id: string, email: string, full_name: string } }
					placeholders = { account: account.id, email: account.email, name: account.full_name, apiToken }
					// A second between requests keeps the account well inside Todoist's limits (1000 reads, 100 full ones, per 15 minutes).
					const proxy = await recording.record(TODOIST, undefined, 1000)
					api = `${proxy.origin}/api/v1/`
					stop = proxy.close
				} else {
					apiToken = stand.apiToken
					placeholders = { ...stand }
					const replay = await recording.replay()
					api = `${replay.origin}/api/v1/`
					stop = replay.close
					unrecorded = () => replay.unrecorded
				}
				TodoistClient.baseUrl = api

				// A run that failed left its projects and label behind, which a Free account has room for only so many of.
				const { body: leftover } = await call<{ projects: Array<{ id: string, name: string }>, labels: Array<{ id: string, name: string }> }>('sync', { sync_token: '*', resource_types: ['projects', 'labels'] })
				const stale = [
					...leftover.projects.filter(project => project.name === HOME).map(project => ({ type: 'project_delete', args: { id: project.id } })),
					...leftover.labels.filter(label => label.name === LABEL).map(label => ({ type: 'label_delete', args: { id: label.id } })),
				]
				if (stale.length) {
					await commands(...stale)
				}

				// Made as the Todoist app makes them, with what Mitra must read and what it must leave alone (priority, labels).
				const { body: { user_plan_limits: limits } } = await call<{ user_plan_limits: { current: { durations?: boolean } } }>('sync', { sync_token: '*', resource_types: ['user_plan_limits'] })
				assert.equal(!!limits.current.durations, pro, `the ${name} recording needs an account on that plan`)
				const temp = (key: string) => ids[key] = crypto.randomUUID()
				const minted = await commands(
					{ type: 'project_add', temp_id: temp('home'), args: { name: HOME, color: 'berry_red' } },
					{ type: 'project_add', temp_id: temp('errands'), args: { name: ERRANDS, parent_id: ids.home } },
					{ type: 'label_add', temp_id: temp('label'), args: { name: LABEL } },
					{ type: 'item_add', temp_id: temp('rent'), args: { project_id: ids.home, content: 'Pay rent', due: { date: '2026-11-02' }, priority: 4, labels: [LABEL] } },
					{ type: 'item_add', temp_id: temp('plumber'), args: { project_id: ids.home, content: 'Call the plumber', due: { date: '2026-11-03T16:00:00', timezone: null } } },
					{ type: 'item_add', temp_id: temp('standup'), args: { project_id: ids.home, content: 'Standup', due: { date: '2026-11-04T14:00:00Z', timezone: 'America/New_York' } } },
					{ type: 'item_add', temp_id: temp('water'), args: { project_id: ids.home, content: 'Water the plants', due: { string: 'every monday at 9am', lang: 'en' } } },
					{ type: 'item_add', temp_id: temp('groceries'), args: { project_id: ids.home, content: 'Buy groceries', description: 'From the **market**\n\n- [ ] oat milk\n- [x] bread' } },
					{ type: 'item_add', temp_id: temp('hallway'), args: { project_id: ids.home, content: 'Paint the hallway' } },
					{ type: 'item_add', temp_id: temp('color'), args: { project_id: ids.home, content: 'Pick a color', parent_id: ids.hallway } },
					{ type: 'item_add', temp_id: temp('parcel'), args: { project_id: ids.errands, content: 'Fetch the parcel' } },
					{ type: 'item_add', temp_id: temp('chore'), args: { project_id: ids.home, content: 'Old chore' } },
					{ type: 'item_close', args: { id: ids.chore } },
					...pro ? [
						{ type: 'item_add', temp_id: temp('taxes'), args: { project_id: ids.home, content: 'File taxes', deadline: { date: '2026-11-30' } } },
						{ type: 'item_add', temp_id: temp('workshop'), args: { project_id: ids.home, content: 'Workshop', due: { date: '2026-11-05T13:00:00Z', timezone: 'Europe/Berlin' }, duration: { amount: 90, unit: 'minute' } } },
						{ type: 'item_add', temp_id: temp('report'), args: { project_id: ids.home, content: 'Write the report', duration: { amount: 45, unit: 'minute' } } },
						{ type: 'item_add', temp_id: temp('trip'), args: { project_id: ids.home, content: 'Trip', due: { date: '2026-11-10' }, duration: { amount: 3, unit: 'day' } } },
					] : [],
				)
				for (const [key, temporary] of Object.entries(ids)) {
					ids[key] = minted[temporary] ?? temporary
				}

				user = new User({ username: `todoist-${name}` })
				const mitra = new MitraCalendar({ userId: user.id, uri: MitraCalendar.uri })
				local = new Source({ integrationId: mitra.id, uri: MitraCalendar.sourceUri('local'), name: 'Local', entryTypes: [EntryType.Event, EntryType.Task], enabled: true, hidden: false })
				await persist(user, mitra, local)
			})

			after(async () => {
				await stop?.()
			})

			const credentials = () => ({ username: '', token: apiToken, timeZone: '', deadlines: false, durations: false })

			it('discovers the account\'s projects, the Inbox first and a nested one under its parent\'s name, all turned off', async () => {
				const discovered = await DiscoverSources.call({ integration: new Todoist({ credentials: credentials() }) })
				assert.equal(discovered[0]!.name, 'Inbox')
				assert.deepEqual(ours(discovered).map(source => source.name), [HOME, `${HOME} · ${ERRANDS}`])
				assert.ok(discovered.every(source => source instanceof Source && !source.enabled))
				assert.equal(ours(discovered)[0]!.color, Color.parse(Todoist.colors.berry_red), 'the color picked in Todoist')
			})

			it('connects with the projects chosen, learning the account and its plan, and imports only their tasks', async () => {
				const discovered = await DiscoverSources.call({ integration: new Todoist({ credentials: credentials() }) })
				integration = await ConnectIntegration.call({ integration: new Todoist({ credentials: credentials(), sources: discovered.map(source => Object.assign(source, { enabled: source.name.startsWith(HOME) })) }) }) as Todoist
				assert.equal(integration.uri, Todoist.accountUri(placeholders.account!))
				assert.deepEqual([integration.credentials.username, integration.credentials.deadlines, integration.credentials.durations], [placeholders.email, pro, pro])

				const expected = ['Buy groceries', 'Call the plumber', 'Old chore', 'Paint the hallway', 'Pay rent', 'Pick a color', 'Standup', 'Water the plants', ...pro ? ['File taxes', 'Trip', 'Workshop', 'Write the report'] : []].sort()
				await until(async () => (await headings(home().id)).length === expected.length)
				assert.deepEqual(await headings(home().id), expected)
				assert.deepEqual(await headings(errands().id), ['Fetch the parcel'])
				assert.deepEqual(await headings(calendar('Inbox').id), [], 'a project left off stays out')
			})

			it('reads each kind of date as Mitra holds it: a day, a floating time, a time fixed in a zone, a repeat at its next date', async () => {
				const rent = await entryOf('Pay rent')
				assert.deepEqual([rent.allDay, iso(rent.start), iso(rent.end)], [true, '2026-11-02T00:00:00.000Z', '2026-11-03T00:00:00.000Z'])

				const plumber = await entryOf('Call the plumber')
				assert.deepEqual([plumber.allDay, plumber.timeZone?.floating, iso(plumber.start), plumber.end], [false, true, '2026-11-03T16:00:00.000Z', undefined])

				const standup = await entryOf('Standup')
				assert.deepEqual([standup.timeZone?.id, iso(standup.start)], ['America/New_York', '2026-11-04T14:00:00.000Z'])

				const water = await entryOf('Water the plants')
				const upstream = await taskOf(ids.water!)
				assert.equal(upstream.due?.is_recurring, true)
				assert.equal(water.recurrence, undefined, 'the repeat stays Todoist\'s')
				assert.equal(iso(water.start), instantOf(upstream.due!))
				assert.equal(water.timeZone?.floating, true)
			})

			it('reads the description, subtasks and done tasks', async () => {
				const groceries = await entryOf('Buy groceries')
				assert.deepEqual([groceries.start, groceries.description], [undefined, 'From the **market**\n\n- [ ] oat milk\n- [x] bread'])
				const color = await entryOf('Pick a color')
				assert.deepEqual(color.relations?.writes.map(relation => [relation.type, relation.targetUid]), [[RelationType.Parent, ids.hallway]])
				assert.equal((await entryOf('Old chore')).status, TaskStatus.Done)
			})

			it('reads a deadline as the due date and a duration as the end, or as the estimate without a date', { skip: !pro && 'the plan holds neither' }, async () => {
				const taxes = await entryOf('File taxes')
				assert.deepEqual([taxes.allDay, iso(taxes.due)], [true, '2026-11-30T00:00:00.000Z'])
				const workshop = await entryOf('Workshop')
				assert.deepEqual([workshop.timeZone?.id, iso(workshop.start), iso(workshop.end)], ['Europe/Berlin', '2026-11-05T13:00:00.000Z', '2026-11-05T14:30:00.000Z'])
				assert.equal((await entryOf('Write the report')).estimate, 45)
				const trip = await entryOf('Trip')
				assert.deepEqual([iso(trip.start), iso(trip.end)], ['2026-11-10T00:00:00.000Z', '2026-11-13T00:00:00.000Z'])
			})

			it('writes a task made in Mitra into its project, with only what the plan holds', async () => {
				const start = new DateTime('2026-11-06T10:00:00Z')
				const created = await CreateEntry.call(EntryPatch.creating(new Entry({
					sourceId: home().id, type: EntryType.Task, heading: 'Plan the week', description: 'Look **ahead**',
					start, end: start.add({ hours: 1 }), timeZone: EntryTimeZone.floating,
					...pro ? { due: new DateTime('2026-11-07T17:00:00Z') } : {},
				})))
				ids.week = created.uri!
				const upstream = await taskOf(created.uri!)
				assert.deepEqual([upstream.content, upstream.description, upstream.project_id], ['Plan the week', 'Look **ahead**', ids.home])
				assert.deepEqual([upstream.due?.date, upstream.due?.timezone], ['2026-11-06T10:00:00', null], 'a floating time')
				assert.deepEqual(upstream.duration ?? null, pro ? { amount: 60, unit: 'minute' } : null)
				assert.deepEqual(upstream.deadline?.date, pro ? '2026-11-07' : undefined)
				assert.equal(iso(created.end), pro ? '2026-11-06T11:00:00.000Z' : undefined, 'without durations, a moment')
			})

			it('refuses a due date where the plan has no deadlines', { skip: pro && 'the plan has them' }, async () => {
				await assert.rejects(CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: home().id, type: EntryType.Task, heading: 'Never written', due: new DateTime('2026-11-07T00:00:00Z'), allDay: true }))))
				assert.ok(!(await headings(home().id)).includes('Never written'))
			})

			it('writes an edit as only what changed, leaving priority and labels as Todoist has them', async () => {
				const rent = await entryOf('Pay rent')
				rent.heading = 'Pay the rent'
				await UpdateEntry.call({ ...EntryPatch.of(rent, ['heading']), id: rent.id! })
				const upstream = await taskOf(ids.rent!)
				assert.deepEqual([upstream.content, upstream.priority, upstream.labels], ['Pay the rent', 4, [LABEL]])
			})

			it('moves a date between a day, a time fixed in a zone and a floating one', async () => {
				const rent = await entryOf('Pay the rent')
				Object.assign(rent, { allDay: false, start: new DateTime('2026-11-02T08:00:00Z'), end: undefined, timeZone: EntryTimeZone.parse('Europe/Madrid') })
				await UpdateEntry.call({ ...EntryPatch.of(rent, ['start', 'end', 'allDay', 'timeZone']), id: rent.id! })
				const fixed = (await taskOf(ids.rent!)).due!
				assert.deepEqual([instantOf(fixed), fixed.timezone], ['2026-11-02T08:00:00.000Z', 'Europe/Madrid'])

				const plumber = await entryOf('Call the plumber')
				Object.assign(plumber, { allDay: true, start: new DateTime('2026-11-04T00:00:00Z'), end: new DateTime('2026-11-05T00:00:00Z'), timeZone: undefined })
				await UpdateEntry.call({ ...EntryPatch.of(plumber, ['start', 'end', 'allDay', 'timeZone']), id: plumber.id! })
				const day = (await taskOf(ids.plumber!)).due!
				assert.deepEqual([day.date, day.timezone], ['2026-11-04', null])
				assert.deepEqual([(await entryOf('Call the plumber')).allDay, iso((await entryOf('Call the plumber')).start)], [true, '2026-11-04T00:00:00.000Z'])
			})

			it('moves a repeating task\'s next date, keeping its rule', async () => {
				const water = await entryOf('Water the plants')
				const moved = water.start!.add({ days: 1 })
				water.start = moved
				await UpdateEntry.call({ ...EntryPatch.of(water, ['start', 'end']), id: water.id! })
				const due = (await taskOf(ids.water!)).due!
				assert.deepEqual([due.is_recurring, due.string, due.lang, instantOf(due)], [true, 'every monday at 9am', 'en', moved.toISOString()])
			})

			it('completes a task and opens it again', async () => {
				const standup = await entryOf('Standup')
				standup.status = TaskStatus.Done
				await UpdateEntry.call({ ...EntryPatch.of(standup, ['status']), id: standup.id! })
				assert.equal((await taskOf(ids.standup!)).checked, true)
				assert.equal((await entryOf('Standup')).status, TaskStatus.Done)

				standup.status = TaskStatus.ToDo
				await UpdateEntry.call({ ...EntryPatch.of(standup, ['status']), id: standup.id! })
				assert.equal((await taskOf(ids.standup!)).checked, false)
			})

			it('completes a repeating task as Todoist does: it moves on to its next date, open', async () => {
				const water = await entryOf('Water the plants')
				const before = water.start!
				water.status = TaskStatus.Done
				const saved = await UpdateEntry.call({ ...EntryPatch.of(water, ['status']), id: water.id! })
				const due = (await taskOf(ids.water!)).due!
				assert.equal(saved.status, TaskStatus.ToDo)
				assert.equal(iso(saved.start), instantOf(due))
				assert.ok(saved.start!.valueOf() > before.valueOf(), 'its next date')
				assert.equal(due.string, 'every monday at 9am')
			})

			it('makes a task a subtask of another, which brings one from another project along, and lets it go again', async () => {
				const groceries = await entryOf('Buy groceries')
				groceries.relateTo(RelationType.Parent, ids.hallway!)
				await UpdateEntry.call({ ...EntryPatch.of(groceries, ['relations']), id: groceries.id! })
				assert.equal((await taskOf(ids.groceries!)).parent_id, ids.hallway)

				const parcel = await entryOf('Fetch the parcel')
				parcel.relateTo(RelationType.Parent, ids.hallway!)
				await UpdateEntry.call({ ...EntryPatch.of(parcel, ['relations']), id: parcel.id! })
				assert.equal((await taskOf(ids.parcel!)).project_id, ids.home, 'Todoist moves a subtask to its parent')
				assert.deepEqual(await headings(errands().id), [])
				assert.ok((await headings(home().id)).includes('Fetch the parcel'))

				const freed = await entryOf('Buy groceries')
				freed.relations = EntryRelations.none
				await UpdateEntry.call({ ...EntryPatch.of(freed, ['relations']), id: freed.id! })
				const upstream = await taskOf(ids.groceries!)
				assert.deepEqual([upstream.parent_id, upstream.project_id], [null, ids.home])
			})

			it('moves a task to another project in place', async () => {
				const week = await entryOf('Plan the week')
				week.sourceId = errands().id
				await UpdateEntry.call({ ...EntryPatch.of(week, ['sourceId']), id: week.id! })
				assert.equal((await taskOf(ids.week!)).project_id, ids.errands)
				const moved = await entryOf('Plan the week')
				assert.deepEqual([moved.id, moved.sourceId], [week.id, errands().id], 'the same entry')
			})

			it('reads what changed in Todoist with the next sync: an edit, a completion, a deletion, a move and a new task', async () => {
				const { ids: added } = await run(
					{ type: 'item_update', args: { id: ids.standup, content: 'Standup, moved', due: { date: '2026-11-04T15:00:00Z', timezone: 'America/New_York' } } },
					{ type: 'item_close', args: { id: ids.color } },
					{ type: 'item_delete', args: { id: ids.chore } },
					{ type: 'item_move', args: { id: ids.groceries, project_id: ids.errands } },
					{ type: 'item_add', temp_id: ids.bank = crypto.randomUUID(), args: { project_id: ids.home, content: 'Call the bank' } },
				)
				ids.bank = added[ids.bank!]!
				await syncNow(integration.id)

				assert.deepEqual(await headings(errands().id), ['Buy groceries', 'Plan the week'])
				const homeNow = await headings(home().id)
				assert.ok(homeNow.includes('Call the bank') && homeNow.includes('Standup, moved') && !homeNow.includes('Old chore'))
				assert.equal(iso((await entryOf('Standup, moved')).start), '2026-11-04T15:00:00.000Z')
				assert.equal((await entryOf('Pick a color')).status, TaskStatus.Done)
			})

			it('creates a task that is already done', async () => {
				const done = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: home().id, type: EntryType.Task, heading: 'Return the books', status: TaskStatus.Done })))
				assert.equal(done.status, TaskStatus.Done)
				assert.equal((await taskOf(done.uri!)).checked, true)
			})

			it('moves an entry from a calendar Mitra keeps into a project', async () => {
				const kept = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId: local.id, type: EntryType.Task, heading: 'Retro' })))
				kept.sourceId = home().id
				await UpdateEntry.call({ ...EntryPatch.of(kept, ['sourceId']), id: kept.id! })
				assert.deepEqual(await headings(local.id), [])
				const moved = await entryOf('Retro')
				assert.equal((await taskOf(moved.uri!)).project_id, ids.home)
				ids.retro = moved.uri!
			})

			it('deletes a task in Todoist, and takes one Todoist no longer has as deleted', async () => {
				await DeleteEntry.call({ id: (await entryOf('Retro')).id! })
				assert.equal((await call(`tasks/${ids.retro}`)).status, 404)

				await commands({ type: 'item_delete', args: { id: ids.bank } })
				await DeleteEntry.call({ id: (await entryOf('Call the bank')).id! })
				assert.ok(!(await headings(home().id)).includes('Call the bank'))
			})

			it('lets go of a project archived in Todoist, and of its tasks', async () => {
				await commands({ type: 'project_archive', args: { id: ids.errands } })
				// As the edit dialog's Refresh asks: through the account already connected.
				const discovered = await DiscoverSources.call({ integration })
				assert.deepEqual(ours(discovered).map(source => source.name), [HOME])
				await syncNow(integration.id)
				integration = (await ListIntegrations.call()).find(each => each.id === integration.id) as Todoist
				assert.deepEqual(ours(integration.sources).map(source => source.name), [HOME])
			})

			it('imports again from scratch, the done tasks of the last weeks included', async () => {
				await ReimportIntegration.call({ id: integration.id })
				await until(async () => (await headings(home().id)).includes('Return the books'))
				const done = (await entriesIn(home().id)).filter(entry => entry.status === TaskStatus.Done.code).map(entry => entry.heading).sort()
				assert.deepEqual(done, ['Pick a color', 'Return the books'])
				assert.ok(!(await headings(home().id)).includes('Old chore'), 'a deleted task stays gone')
			})

			it('disconnects, leaving the projects as they are', async () => {
				const homeId = home().id
				await DisconnectIntegration.call({ id: integration.id })
				assert.deepEqual(await entriesIn(homeId), [])
				const { body } = await call<{ results: Array<TodoistTask> }>(`tasks?project_id=${ids.home}`)
				assert.ok(body.results.some(task => task.content === 'Pay the rent'))
			})

			it('leaves the account as it found it', async () => {
				await commands({ type: 'project_delete', args: { id: ids.home } }, { type: 'label_delete', args: { id: ids.label } })
			})

			it('asked Todoist only what it answered when the recording was made', () => {
				assert.deepEqual(unrecorded(), [], 'Mitra asks Todoist something new since the recording: record again (see above)')
			})
		})
	}
})
