import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../../features/identity/User.js'
import { Identity } from '../../../features/identity/Identity.js'
import { Source } from '../../../features/sources/Source.js'
import { Recurrence } from '../../../features/recurrence/Recurrence.js'
import { Entry } from '../../../features/entries/Entry.js'
import { EntryRelation } from '../../../features/relations/EntryRelation.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { Integration } from '../../Integration.js'
import { CalDAV } from '../../caldav/CalDAV.js'
import { GoogleCalendar } from '../../google/GoogleCalendar.js'
import { AppleCalendar } from '../../apple/AppleCalendar.js'
import { Notion } from '../../notion/Notion.js'
import { Dev } from '../../dev/Dev.js'
import { NotificationSubscription } from '../../../features/reminders/NotificationSubscription.js'
import { Session } from '../../../features/identity/server/Session.js'
import { Tempo, type TempoWorklog } from '../Tempo.js'
import { TempoSyncEngine } from './TempoSyncEngine.js'
import { TempoRequestError, type TempoClient } from './TempoClient.js'
import { type JiraClient } from './JiraClient.js'

const ACCOUNT = 'acct:0000-1111'
const SITE = 'https://acme.atlassian.net'
const BERLIN = 'Europe/Berlin'

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Tempo, Dev, Source, Entry, EntryRelation, Recurrence, NotificationSubscription, Session],
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

const worklog = (init?: Partial<TempoWorklog>): TempoWorklog => ({
	tempoWorklogId: 42,
	issue: { id: 10001 },
	timeSpentSeconds: 3600,
	startDate: '2026-08-03',
	startTime: '09:34:00',
	description: 'Refactoring',
	updatedAt: '2026-08-03T09:00:00Z',
	author: { accountId: ACCOUNT },
	...init,
})

interface StubState {
	worklogs?: Array<TempoWorklog>
	deleted?: Array<{ tempoWorklogId: string, deletedAt: string }>
	issues?: Record<string, { id: string, key: string, summary: string }>
	projectKeys?: Array<string>
	jiraError?: Error
	createEcho?: TempoWorklog
	updateEcho?: TempoWorklog
	deleteError?: Error
}

function stubClients(state: StubState) {
	const calls = {
		searches: new Array<string | undefined>(),
		created: new Array<Record<string, unknown>>(),
		updated: new Array<{ worklogId: string, input: Record<string, unknown> }>(),
		deleted: new Array<string>(),
		bulkFetched: new Array<Array<string>>(),
		projectReads: 0,
	}
	const tempo = {
		globalConfiguration: () => Promise.resolve({}),
		searchWorklogs: (_accountId: string, updatedFrom?: string) => {
			calls.searches.push(updatedFrom)
			return Promise.resolve(state.worklogs ?? [])
		},
		deletedWorklogs: () => Promise.resolve(state.deleted ?? []),
		createWorklog: (input: Record<string, unknown>) => {
			calls.created.push(input)
			return Promise.resolve(state.createEcho ?? worklog({ tempoWorklogId: 99 }))
		},
		updateWorklog: (worklogId: string, input: Record<string, unknown>) => {
			calls.updated.push({ worklogId, input })
			return Promise.resolve(state.updateEcho ?? worklog({ ...input as object, tempoWorklogId: Number(worklogId) } as Partial<TempoWorklog>))
		},
		deleteWorklog: (worklogId: string) => {
			if (state.deleteError) {
				return Promise.reject(state.deleteError)
			}
			calls.deleted.push(worklogId)
			return Promise.resolve()
		},
	}
	const jira = {
		myself: () => Promise.resolve({ accountId: ACCOUNT, displayName: 'Alice Example', emailAddress: 'alice@example.com', timeZone: BERLIN }),
		issues: (idsOrKeys: Array<string>) => {
			calls.bulkFetched.push(idsOrKeys)
			if (state.jiraError) {
				return Promise.reject(state.jiraError)
			}
			const resolved = new Map<string, { id: string, key: string, summary: string }>()
			for (const idOrKey of idsOrKeys) {
				const issue = state.issues?.[idOrKey]
				if (issue) {
					resolved.set(issue.id, issue)
					resolved.set(issue.key, issue)
				}
			}
			return Promise.resolve(resolved)
		},
		projectKeys: () => {
			calls.projectReads++
			return state.jiraError ? Promise.reject(state.jiraError) : Promise.resolve(state.projectKeys ?? ['ACME', 'NOVA'])
		},
	}
	return { tempo: tempo as unknown as TempoClient, jira: jira as unknown as JiraClient, calls }
}

async function seed(em: EntityManager, state: StubState) {
	const user = new User({ username: `alice-${crypto.randomUUID()}` })
	const integration = new Tempo({
		userId: user.id,
		uri: `${Tempo.uriPrefix}${ACCOUNT}`,
		credentials: { username: 'Alice Example', site: SITE, token: 'tempo-secret', jiraEmail: 'alice@example.com', jiraToken: 'jira-secret', timeZone: BERLIN },
	})
	const source = new Source({ integrationId: integration.id, uri: Tempo.sourceUri(ACCOUNT), entryTypes: [EntryType.Event], name: 'My worklogs', enabled: true })
	em.persist([user, integration, source])
	await em.flush()
	const { tempo, jira, calls } = stubClients(state)
	integration.client = tempo
	integration.jiraClient = jira
	return { user, integration, source, calls, state }
}

const engine = new TempoSyncEngine()
const ACME_1234 = { id: '10001', key: 'ACME-1234', summary: 'Fix the parser' }

describe('Tempo discovery', () => {
	let orm: MikroORM
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('takes its identity from the Jira account and labels itself with the e-mail', async () => {
		const em = orm.em.fork()
		const { integration } = await seed(em, {})
		const sources = await engine.fetchSources(integration)

		assert.equal(integration.uri, `${Tempo.uriPrefix}${ACCOUNT}`)
		assert.equal(integration.credentials.username, 'alice@example.com')
		assert.deepEqual(sources.map(source => [source.uri, source.name, source.enabled]), [
			[Tempo.sourceUri(ACCOUNT), 'My worklogs', false],
		])
		assert.deepEqual(sources[0]!.entryTypes, [EntryType.Event])
	})

	it('falls back to the typed e-mail when Jira withholds the address', async () => {
		const em = orm.em.fork()
		const { integration } = await seed(em, {})
		integration.jiraClient = { myself: () => Promise.resolve({ accountId: ACCOUNT, timeZone: BERLIN }) } as unknown as JiraClient
		await engine.fetchSources(integration)

		assert.equal(integration.credentials.username, 'alice@example.com')
	})

	it('says which of the two credentials was rejected', async () => {
		const em = orm.em.fork()
		const { integration } = await seed(em, {})
		integration.jiraClient = { myself: () => Promise.reject(new Error('401 Unauthorized')) } as unknown as JiraClient
		await assert.rejects(() => engine.fetchSources(integration), /Jira rejected/)
	})
})

describe('Tempo sync', () => {
	let orm: MikroORM
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	const sync = (integration: Tempo, em: EntityManager, source: Source) => engine.syncSourceEntries(integration, em, source)

	it('creates entries for the author\'s worklogs and advances the watermark to the newest seen', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			worklogs: [
				worklog({ tempoWorklogId: 1, updatedAt: '2026-08-03T09:00:00Z' }),
				worklog({ tempoWorklogId: 2, description: 'Review', timeSpentSeconds: 1800, updatedAt: '2026-08-04T11:00:00Z' }),
			],
			issues: { '10001': ACME_1234 },
		})

		assert.equal(await sync(integration, em, source), true)
		await em.flush()

		const entries = await em.find(Entry, { sourceId: source.id }, { orderBy: { uri: 'asc' } })
		assert.deepEqual(entries.map(entry => [entry.uri, entry.heading, entry.description]), [
			['1', 'ACME-1234 Fix the parser', 'Refactoring'],
			['2', 'ACME-1234 Fix the parser', 'Review'],
		])
		assert.equal((entries[1]!.end as unknown as Date).toISOString(), '2026-08-03T08:04:00.000Z')
		assert.equal(source.syncState?.updatedFrom, '2026-08-04T11:00:00Z')
	})

	it('asks for the delta with an overlap, and only after a first full pull', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			worklogs: [worklog({ updatedAt: '2026-08-03T09:00:00Z' })],
			issues: { '10001': ACME_1234 },
		})

		await sync(integration, em, source)
		await em.flush()
		await sync(integration, em, source)

		assert.equal(calls.searches[0], undefined)
		assert.equal(calls.searches[1], '2026-08-03T08:59:00.000Z')
	})

	it('stays silent when the overlap window re-serves an already-applied worklog', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, { worklogs: [worklog()], issues: { '10001': ACME_1234 } })

		assert.equal(await sync(integration, em, source), true)
		await em.flush()
		assert.equal(await sync(integration, em, source), false)
	})

	it('applies a remote edit and reports it', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, { worklogs: [worklog()], issues: { '10001': ACME_1234 } })
		await sync(integration, em, source)
		await em.flush()

		state.worklogs = [worklog({ timeSpentSeconds: 7200, updatedAt: '2026-08-05T08:00:00Z' })]
		assert.equal(await sync(integration, em, source), true)
		await em.flush()

		const entry = await em.findOneOrFail(Entry, { sourceId: source.id })
		assert.equal((entry.end as unknown as Date).toISOString(), '2026-08-03T09:34:00.000Z')
	})

	it('removes a worklog the audit feed reports as deleted', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, { worklogs: [worklog()], issues: { '10001': ACME_1234 } })
		await sync(integration, em, source)
		await em.flush()

		state.worklogs = []
		state.deleted = [{ tempoWorklogId: '42', deletedAt: '2026-08-06T10:00:00Z' }]
		assert.equal(await sync(integration, em, source), true)
		await em.flush()

		assert.equal(await em.count(Entry, { sourceId: source.id }), 0)
	})

	it('resolves each issue once and reuses the memo', async () => {
		const em = orm.em.fork()
		const { integration, source, state, calls } = await seed(em, {
			worklogs: [worklog({ tempoWorklogId: 1 }), worklog({ tempoWorklogId: 2 })],
			issues: { '10001': ACME_1234 },
		})
		await sync(integration, em, source)
		await em.flush()

		state.worklogs = [worklog({ tempoWorklogId: 3, updatedAt: '2026-08-09T09:00:00Z' })]
		await sync(integration, em, source)

		assert.deepEqual(calls.bulkFetched, [['10001']])
		assert.deepEqual(source.syncState?.issues, { '10001': { key: 'ACME-1234', summary: 'Fix the parser' } })
	})

	it('labels an entry by issue id when Jira cannot answer, and never fails the sync for it', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, { worklogs: [worklog()], jiraError: new Error('503 Service Unavailable') })

		assert.equal(await sync(integration, em, source), true)
		await em.flush()

		const entry = await em.findOneOrFail(Entry, { sourceId: source.id })
		assert.equal(entry.heading, '#10001')
		assert.equal(entry.data?.url, undefined)
	})
})

describe('Tempo writes', () => {
	let orm: MikroORM
	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	const syncedEntry = async (em: EntityManager, init?: { stored?: TempoWorklog }) => {
		const seeded = await seed(em, { worklogs: [init?.stored ?? worklog()], issues: { '10001': ACME_1234 } })
		await engine.syncSourceEntries(seeded.integration, em, seeded.source)
		await em.flush()
		return { ...seeded, entry: await em.findOneOrFail(Entry, { sourceId: seeded.source.id }) }
	}

	it('books a new worklog against the ticket named anywhere in the title', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, { issues: { 'ACME-1234': ACME_1234 } })
		const entry = new Entry({
			id: crypto.randomUUID(),
			sourceId: source.id,
			heading: 'Work on ACME-1234',
			start: new Date('2026-08-10T09:00:00+02:00') as never,
			end: new Date('2026-08-10T10:30:00+02:00') as never,
		})

		await engine.createEntry(integration, em, entry)

		assert.deepEqual(calls.created, [{
			issueId: 10001,
			authorAccountId: ACCOUNT,
			startDate: '2026-08-10',
			startTime: '09:00:00',
			timeSpentSeconds: 5400,
			description: 'Work on ACME-1234',
		}])
	})

	it('books a duplicate against the same ticket, keeping its note rather than its title', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, { issues: { 'ACME-1234': ACME_1234 } })
		await engine.createEntry(integration, em, new Entry({
			id: crypto.randomUUID(),
			sourceId: source.id,
			heading: 'ACME-1234 Fix the parser',
			description: 'Pairing',
			start: new Date('2026-08-10T09:00:00+02:00') as never,
			end: new Date('2026-08-10T10:00:00+02:00') as never,
		}))

		assert.equal(calls.created[0]!.description, 'Pairing')
	})

	it('books the wall clock the entry sits at, in the account zone', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, { issues: { 'ACME-1234': ACME_1234 } })
		await engine.createEntry(integration, em, new Entry({
			id: crypto.randomUUID(),
			sourceId: source.id,
			heading: 'ACME-1234 Late night',
			start: new Date('2026-08-24T22:30:00+02:00') as never,
			end: new Date('2026-08-24T23:00:00+02:00') as never,
		}))

		assert.equal(calls.created[0]!.startDate, '2026-08-24')
		assert.equal(calls.created[0]!.startTime, '22:30:00')
	})

	it('refuses a title naming no ticket, and one naming a project Jira does not have', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, { issues: { 'ACME-1234': ACME_1234 }, projectKeys: ['ACME'] })
		const draft = (heading: string) => new Entry({
			id: crypto.randomUUID(),
			sourceId: source.id,
			heading,
			start: new Date('2026-08-10T09:00:00Z') as never,
			end: new Date('2026-08-10T10:00:00Z') as never,
		})

		await assert.rejects(() => engine.createEntry(integration, em, draft('Refactoring')), /No Jira ticket/)
		await assert.rejects(() => engine.createEntry(integration, em, draft('Read up on ISO-8601')), /No Jira ticket/)
	})

	it('refuses a worklog with no duration', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, heading: 'ACME-1234 x' })
		await assert.rejects(() => engine.createEntry(integration, em, entry), /needs a start and a duration/)
	})

	it('carries the fields mitra never shows through a move', async () => {
		const em = orm.em.fork()
		const stored = worklog({ billableSeconds: 1800, attributes: { values: [{ key: '_Category_', value: 'Coding' }] } })
		const { integration, entry, calls } = await syncedEntry(em, { stored })

		const moved = entry.clone()
		moved.start = new Date('2026-08-04T11:00:00+02:00') as never
		moved.end = new Date('2026-08-04T12:00:00+02:00') as never
		await engine.updateEntry(integration, em, entry, moved)

		assert.deepEqual(calls.updated, [{
			worklogId: '42',
			input: {
				authorAccountId: ACCOUNT,
				startDate: '2026-08-04',
				startTime: '11:00:00',
				timeSpentSeconds: 3600,
				billableSeconds: 1800,
				attributes: [{ key: '_Category_', value: 'Coding' }],
				description: 'Refactoring',
			},
		}])
	})

	it('writes an edited note straight through', async () => {
		const em = orm.em.fork()
		const { integration, entry, calls } = await syncedEntry(em)

		const edited = entry.clone()
		edited.description = 'Refactoring and tests'
		await engine.updateEntry(integration, em, entry, edited)

		assert.equal(calls.updated[0]!.input.description, 'Refactoring and tests')
	})

	it('does not rewrite a note whose own text a move never touched', async () => {
		const em = orm.em.fork()
		const stored = worklog({ description: 'Planning session\n' })
		const { integration, entry, calls } = await syncedEntry(em, { stored })

		const moved = entry.clone()
		moved.start = new Date('2026-08-04T11:00:00Z') as never
		moved.end = new Date('2026-08-04T12:00:00Z') as never
		await engine.updateEntry(integration, em, entry, moved)

		assert.equal(calls.updated[0]!.input.description, 'Planning session\n')
	})

	it('deletes a worklog, and treats one already gone as deleted rather than as an error', async () => {
		const em = orm.em.fork()
		const { integration, entry, calls, state } = await syncedEntry(em)
		await engine.deleteEntry(integration, em, entry)
		assert.deepEqual(calls.deleted, ['42'])

		state.deleteError = new TempoRequestError(404, 'Tempo request failed (404)')
		const { integration: second, entry: secondEntry } = await syncedEntry(orm.em.fork())
		await engine.deleteEntry(second, orm.em.fork(), secondEntry)
	})

	it('propagates a delete failure that is not a 404', async () => {
		const em = orm.em.fork()
		const { integration, entry, state } = await syncedEntry(em)
		state.deleteError = new TempoRequestError(403, 'Tempo request failed (403)')
		await assert.rejects(() => engine.deleteEntry(integration, em, entry), /403/)
	})

	it('has no recurrence to exclude an occurrence from', async () => {
		await assert.rejects(() => engine.excludeOccurrence(), /cannot repeat/)
	})
})
