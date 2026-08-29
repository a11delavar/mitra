import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User } from '../../../features/identity/User.js'
import { Source } from '../../../features/sources/Source.js'
import { RelationType } from '../../../features/relations/RelationType.js'
import { Recurrence } from '../../../features/recurrence/Recurrence.js'
import { Notion } from '../Notion.js'
import { Integration } from '../../Integration.js'
import { Identity } from '../../../features/identity/Identity.js'
import { GoogleCalendar } from '../../google/GoogleCalendar.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { EntryRelations } from '../../../features/relations/EntryRelations.js'
import { EntryRelation } from '../../../features/relations/EntryRelation.js'
import { Entry, TaskStatus } from '../../../features/entries/Entry.js'
import { CalDAV } from '../../caldav/CalDAV.js'
import { AppleCalendar } from '../../apple/AppleCalendar.js'
import { NotionRequestError, type NotionBlock, type NotionClient, type NotionDataSource, type NotionPage } from '../NotionClient.js'
import { Dev } from '../../dev/Dev.js'
import { NotificationSubscription } from '../../../features/reminders/NotificationSubscription.js'
import { Session } from '../../../features/identity/server/Session.js'

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Dev, Source, Entry, EntryRelation, Recurrence, NotificationSubscription, Session],
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

const dataSource = (): NotionDataSource => ({
	object: 'data_source',
	id: 'ds-1',
	title: [{ plain_text: 'Tasks' }],
	properties: {
		'Name': { id: 'title', name: 'Name', type: 'title' },
		'Status': {
			id: 'st', name: 'Status', type: 'status', status: {
				options: [
					{ id: 'o-todo', name: 'Not started' },
					{ id: 'o-doing', name: 'In progress' },
					{ id: 'o-done', name: 'Done' },
				],
				groups: [
					{ id: 'g1', name: 'To-do', option_ids: ['o-todo'] },
					{ id: 'g2', name: 'In progress', option_ids: ['o-doing'] },
					{ id: 'g3', name: 'Complete', option_ids: ['o-done'] },
				],
			},
		},
		'Due': { id: 'due', name: 'Due', type: 'date' },
		'Area': { id: 'area', name: 'Area', type: 'select' },
		'Parent Task': { id: 'uXhq', name: 'Parent Task', type: 'relation', relation: { data_source_id: 'ds-1', type: 'dual_property', dual_property: { synced_property_name: 'Sub Tasks' } } },
		'Sub Tasks': { id: 'VrqI', name: 'Sub Tasks', type: 'relation', relation: { data_source_id: 'ds-1', type: 'dual_property', dual_property: { synced_property_name: 'Parent Task' } } },
		'Blocked by': { id: '%5CHMd', name: 'Blocked by', type: 'relation', relation: { data_source_id: 'ds-1', type: 'dual_property', dual_property: { synced_property_name: 'Blocking' } } },
		'Blocking': { id: '%40n~I', name: 'Blocking', type: 'relation', relation: { data_source_id: 'ds-1', type: 'dual_property', dual_property: { synced_property_name: 'Blocked by' } } },
	},
})

const page = (id: string, init?: { title?: string, status?: string, date?: string | null, editedAt?: string, inTrash?: boolean, parent?: Array<string>, blockedBy?: Array<string>, truncated?: boolean }): NotionPage => ({
	object: 'page',
	id,
	last_edited_time: init?.editedAt ?? '2026-07-10T10:00:00.000Z',
	in_trash: init?.inTrash,
	url: `https://www.notion.so/${id}`,
	properties: {
		'Name': { type: 'title', title: [{ plain_text: init?.title ?? `Task ${id}` }] },
		'Status': { type: 'status', status: { id: init?.status ?? 'o-todo', name: '' } },
		'Due': { type: 'date', date: init?.date === null ? null : { start: init?.date ?? '2026-07-15', end: null, time_zone: null } },
		'Parent Task': { id: 'uXhq', type: 'relation', relation: (init?.parent ?? []).map(target => ({ id: target })) },
		'Blocked by': { id: '%5CHMd', type: 'relation', relation: (init?.blockedBy ?? []).map(target => ({ id: target })), has_more: init?.truncated },
	},
})

interface StubState {
	members?: { ids: Array<string>, complete: boolean }
	delta?: Array<NotionPage>
	byId?: Record<string, NotionPage>
	bodies?: Record<string, Array<NotionBlock>>
	updateEcho?: NotionPage
	createEcho?: NotionPage
	trashError?: Error
	viewFilter?: unknown
	viewQuickFilters?: unknown
	views?: Array<{ object: string, id: string, name: string, type: string }>
	fullRelation?: Array<string>
	relationError?: Error
}

function stubClient(state: StubState) {
	const calls = {
		updates: new Array<{ pageId: string, properties: Record<string, unknown> }>(),
		trashed: new Array<string>(),
		individuallyFetched: new Array<string>(),
		deletedBlocks: new Array<string>(),
		appended: new Array<{ blockId: string, children: Array<NotionBlock> }>(),
		createChildren: new Array<NotionBlock>(),
		relationDrains: new Array<{ pageId: string, propertyId: string }>(),
	}
	const client = {
		me: () => Promise.resolve({ object: 'user', id: 'bot-1', bot: { workspace_name: 'Acme' } }),
		searchDataSources: () => Promise.resolve([dataSource()]),
		views: () => Promise.resolve(state.views ?? [
			{ object: 'view', id: 'view-1', name: 'All', type: 'table' },
			{ object: 'view', id: 'view-2', name: 'Board', type: 'board' },
		]),
		dataSource: () => Promise.resolve(dataSource()),
		view: (id: string) => Promise.resolve({ object: 'view', id, name: 'All', type: 'table', filter: state.viewFilter, quick_filters: state.viewQuickFilters }),
		viewPageIds: () => Promise.resolve(state.members ?? { ids: [], complete: true }),
		queryDataSourcePages: () => Promise.resolve(state.delta ?? []),
		page: (id: string) => {
			calls.individuallyFetched.push(id)
			const found = state.byId?.[id]
			return found ? Promise.resolve(found) : Promise.reject(new Error(`no page ${id}`))
		},
		pageRelation: (pageId: string, propertyId: string) => {
			calls.relationDrains.push({ pageId, propertyId })
			return state.relationError ? Promise.reject(state.relationError) : Promise.resolve((state.fullRelation ?? []).map(id => ({ id })))
		},
		blockChildren: (blockId: string) => Promise.resolve(state.bodies?.[blockId] ?? []),
		appendBlockChildren: (blockId: string, children: Array<NotionBlock>) => {
			calls.appended.push({ blockId, children })
			return Promise.resolve()
		},
		deleteBlock: (blockId: string) => {
			calls.deletedBlocks.push(blockId)
			return Promise.resolve()
		},
		createPage: (_dataSourceId: string, properties: Record<string, unknown>, children?: Array<NotionBlock>) => {
			calls.updates.push({ pageId: '(create)', properties })
			calls.createChildren.push(...(children ?? []))
			return Promise.resolve(state.createEcho ?? page('page-created', { editedAt: new Date().toISOString() }))
		},
		updatePage: (pageId: string, properties: Record<string, unknown>) => {
			calls.updates.push({ pageId, properties })
			return Promise.resolve(state.updateEcho ?? page(pageId, { editedAt: new Date().toISOString() }))
		},
		trashPage: (pageId: string) => {
			if (state.trashError) {
				return Promise.reject(state.trashError)
			}
			calls.trashed.push(pageId)
			return Promise.resolve(page(pageId, { inTrash: true }))
		},
	}
	return { client: client as unknown as NotionClient, calls }
}

async function seed(em: EntityManager, state: StubState) {
	const user = new User({ username: `alice-${crypto.randomUUID()}` })
	const integration = new Notion({ userId: user.id, uri: 'notion://bot-1', credentials: { username: 'Acme', token: 'ntn_secret' } })
	const source = new Source({ integrationId: integration.id, uri: 'notion://ds-1/view-1', entryTypes: [EntryType.Task], name: 'Tasks · All', enabled: true, hidden: false })
	const sibling = new Source({ integrationId: integration.id, uri: 'notion://ds-1/view-2', entryTypes: [EntryType.Task], name: 'Tasks · Board', enabled: false, hidden: false })
	em.persist([user, integration, source, sibling])
	await em.flush()
	const { client, calls } = stubClient(state)
	;(integration as any).client = client
	return { user, integration, source, sibling, calls, state }
}

const sync = (integration: Notion, em: EntityManager, source: Source): Promise<boolean> =>
	(integration as any).syncSourceEntries(em, source)

describe('Notion sync', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('creates entries for the view\'s members on first sync and advances the watermark to the newest edit seen', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [
				page('p1', { title: 'Write the report', status: 'o-doing', editedAt: '2026-07-10T10:00:00.000Z' }),
				page('p2', { title: 'File taxes', status: 'o-done', date: '2026-07-20', editedAt: '2026-07-11T09:00:00.000Z' }),
			],
		})

		assert.equal(await sync(integration, em, source), true)
		await em.flush()

		const entries = await em.find(Entry, { sourceId: source.id }, { orderBy: { heading: 'desc' } })
		assert.deepEqual(entries.map(e => [e.uri, e.heading, e.status, e.type]), [
			['p1', 'Write the report', TaskStatus.Doing, EntryType.Task],
			['p2', 'File taxes', TaskStatus.Done, EntryType.Task],
		])
		assert.equal((entries[0]!.start as unknown as Date).toISOString(), '2026-07-15T00:00:00.000Z')
		assert.equal(source.syncState?.lastEditedAfter, '2026-07-11T09:00:00.000Z')
	})

	it('stays silent when the overlap window re-serves already-applied edits (the boolean contract)', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1', { title: 'Same as before' })],
		})
		assert.equal(await sync(integration, em, source), true)
		await em.flush()
		assert.equal(await sync(integration, em, source), false)
	})

	it('applies a remote edit and reports it', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1', { title: 'Draft the plan' })],
		})
		await sync(integration, em, source)
		await em.flush()

		state.delta = [page('p1', { title: 'Draft the plan v2', status: 'o-done', editedAt: '2026-07-12T08:00:00.000Z' })]
		assert.equal(await sync(integration, em, source), true)
		const entry = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })
		assert.equal(entry.heading, 'Draft the plan v2')
		assert.equal(entry.status, TaskStatus.Done)
	})

	it('removes rows whose pages left the view (trashed or filtered out)', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [page('p1'), page('p2')],
		})
		await sync(integration, em, source)
		await em.flush()

		state.members = { ids: ['p1'], complete: true }
		state.delta = []
		assert.equal(await sync(integration, em, source), true)
		await em.flush()
		assert.deepEqual((await em.find(Entry, { sourceId: source.id })).map(e => e.uri), ['p1'])
	})

	it('never removes a row edited moments ago — the view index may not surface a fresh page yet', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
		})
		await sync(integration, em, source)
		await em.flush()

		const fresh = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p-fresh', type: EntryType.Task, heading: 'Just created', data: { localWriteAt: Date.now() } })
		em.persist(fresh)
		await em.flush()

		state.delta = []
		await sync(integration, em, source)
		await em.flush()
		assert.ok(await em.findOne(Entry, { sourceId: source.id, uri: 'p-fresh' }))
	})

	it('deletes a stale row whose write time has aged past the grace window', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
		})
		await sync(integration, em, source)
		await em.flush()

		const stale = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p-old', type: EntryType.Task, heading: 'Left the view', data: { localWriteAt: Date.now() - 10 * 60_000 } })
		em.persist(stale)
		await em.flush()

		state.delta = []
		await sync(integration, em, source)
		await em.flush()
		assert.equal(await em.findOne(Entry, { sourceId: source.id, uri: 'p-old' }), null)
	})

	it('prunes a created task once it leaves (or never joins) the view — the source mirrors the view', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
		})
		await sync(integration, em, source)
		await em.flush()

		const orphan = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p-mine', type: EntryType.Task, heading: 'Not a member', data: { localWriteAt: Date.now() - 10 * 60_000 } })
		em.persist(orphan)
		await em.flush()

		state.delta = []
		await sync(integration, em, source)
		await em.flush()
		assert.equal(await em.findOne(Entry, { sourceId: source.id, uri: 'p-mine' }), null)
	})

	it('stamps a created entry with a local-clock write time so the next cycle spares it', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			createEcho: page('page-new', { title: 'Buy milk', editedAt: '2000-01-01T00:00:00.000Z' }),
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Buy milk' })
		const before = Date.now()
		await integration.createEntry(em, entry)
		assert.ok((entry.data?.localWriteAt ?? 0) >= before)
	})

	it('skips deletion detection entirely when the membership is truncated, but still applies edits', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [page('p1'), page('p2')],
		})
		await sync(integration, em, source)
		await em.flush()

		state.members = { ids: ['p1'], complete: false }
		state.delta = [page('p1', { title: 'Edited meanwhile', editedAt: '2026-07-12T08:00:00.000Z' })]
		await sync(integration, em, source)
		await em.flush()
		const entries = await em.find(Entry, { sourceId: source.id })
		assert.equal(entries.length, 2)
		assert.equal(entries.find(e => e.uri === 'p1')?.heading, 'Edited meanwhile')
	})

	it('fetches a member individually when it slid into the view without an edit', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			members: { ids: ['p-old'], complete: true },
			delta: [],
			byId: { 'p-old': page('p-old', { title: 'Slid into view' }) },
		})
		const s = source
		s.syncState = { lastEditedAfter: '2026-07-13T00:00:00.000Z' }
		await sync(integration, em, s)
		await em.flush()
		assert.deepEqual(calls.individuallyFetched, ['p-old'])
		assert.equal((await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p-old' })).heading, 'Slid into view')
	})

	it('reads the page body into the markdown description', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1', { title: 'With notes' })],
			bodies: {
				p1: [
					{ object: 'block', id: 'b1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Call ' }, { plain_text: 'them', annotations: { bold: true } }] } },
					{ object: 'block', id: 'b2', type: 'embed' },
				],
			},
		})
		await sync(integration, em, source)
		const entry = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })
		assert.equal(entry.description, 'Call **them**')
	})

	it('reports a body-only remote edit as a change (the stamp may not even move)', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
			bodies: { p1: [{ object: 'block', id: 'b1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'v1' }] } }] },
		})
		await sync(integration, em, source)
		await em.flush()

		state.bodies = { p1: [{ object: 'block', id: 'b1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'v2' }] } }] }
		assert.equal(await sync(integration, em, source), true)
		assert.equal((await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })).description, 'v2')
	})

	it('never materializes a trashed page the delta still carries', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1', { inTrash: true })],
		})
		assert.equal(await sync(integration, em, source), false)
		assert.equal(await em.findOne(Entry, { sourceId: source.id, uri: 'p1' }), null)
	})
})

describe('Notion entry CRUD', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('adopts the created page as the entry\'s canonical state', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			createEcho: page('page-new', { title: 'Buy milk', status: 'o-todo', editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Buy milk' })
		const created = await integration.createEntry(em, entry)
		await em.flush()
		assert.equal(created.uri, 'page-new')
		assert.equal(created.data?.etag, '2026-07-14T12:00:00.000Z')
	})

	it('pre-fills the view\'s filter properties so a created task actually lands in the filtered view', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			viewFilter: { property: 'area', select: { equals: 'University' } },
			createEcho: page('page-new', { title: 'Read chapter 3', editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Read chapter 3', status: TaskStatus.ToDo })
		await integration.createEntry(em, entry)
		const created = calls.updates.find(u => u.pageId === '(create)')!
		assert.deepEqual(created.properties['Area'], { select: { name: 'University' } })
		assert.ok(created.properties['Name'], 'title still written')
		assert.ok(created.properties['Status'], 'status still written')
	})

	it('pre-fills a relation the view filters on (the real "Area = University" shape) from quick_filters', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			viewQuickFilters: { area: { relation: { contains: 'university-page-id' } } },
			createEcho: page('page-new', { editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		;(integration as any).client.dataSource = () => Promise.resolve({ object: 'data_source', id: 'ds-1', title: [{ plain_text: 'Tasks' }], properties: {
			Name: { id: 'title', name: 'Name', type: 'title' },
			Status: dataSource().properties['Status'],
			Due: { id: 'due', name: 'Due', type: 'date' },
			Area: { id: 'area', name: 'Area', type: 'relation' },
		} })
		;(integration as any).dataSources = undefined
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Read chapter 3', status: TaskStatus.ToDo })
		await integration.createEntry(em, entry)
		const created = calls.updates.find(u => u.pageId === '(create)')!
		assert.deepEqual(created.properties['Area'], { relation: [{ id: 'university-page-id' }] })
	})

	it('lets the user\'s mapped status win over a status the view filters on', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			viewFilter: { property: 'st', status: { equals: 'Done' } },
			createEcho: page('page-new', { editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Start reading', status: TaskStatus.ToDo })
		await integration.createEntry(em, entry)
		const created = calls.updates.find(u => u.pageId === '(create)')!
		assert.deepEqual(created.properties['Status'], { status: { id: 'o-todo' } })
	})

	it('still creates the task when the view filter can\'t be read (best-effort pre-fill)', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, { createEcho: page('page-new', { editedAt: '2026-07-14T12:00:00.000Z' }) })
		;(integration as any).client.view = () => Promise.reject(new Error('view fetch hiccup'))
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Resilient', status: TaskStatus.ToDo })
		const created = await integration.createEntry(em, entry)
		assert.equal(created.uri, 'page-new')
		const create = calls.updates.find(u => u.pageId === '(create)')!
		assert.ok(create.properties['Name'], 'the task is created without the filter pre-fill rather than failing')
	})

	it('sends the description as the created page\'s body', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			createEcho: page('page-new', { title: 'Prepare talk', editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Prepare talk', description: '- [ ] draft slides' })
		await integration.createEntry(em, entry)
		assert.deepEqual(calls.createChildren.map(block => block.type), ['to_do'])
		assert.equal(calls.createChildren[0]!.to_do?.rich_text?.[0]?.text?.content, 'draft slides')
		assert.equal(entry.description, '- [ ] draft slides')
	})

	it('replaces only the blocks the description showed — collaborative content it could not render survives', async () => {
		const em = orm.em.fork()
		const { integration, source, sibling, calls } = await seed(em, {
			byId: { p1: page('p1', { editedAt: '2026-07-14T12:00:00.000Z' }) },
			bodies: {
				p1: [
					{ object: 'block', id: 'b-para', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Old notes' }] } },
					{ object: 'block', id: 'b-image', type: 'image' },
					{ object: 'block', id: 'b-subpage', type: 'child_page', has_children: true },
				],
			},
		})
		const existing = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p1', type: EntryType.Task, heading: 'Task p1', status: TaskStatus.ToDo, description: 'Old notes' })
		const twin = new Entry({ id: crypto.randomUUID(), sourceId: sibling.id, uri: 'p1', type: EntryType.Task, heading: 'Task p1', status: TaskStatus.ToDo, description: 'Old notes' })
		em.persist([existing, twin])
		await em.flush()

		const incoming = existing.clone()
		incoming.description = '# New plan'
		await integration.updateEntry(em, existing, incoming)
		await em.flush()

		assert.deepEqual(calls.deletedBlocks, ['b-para'], 'only the replaceable block goes — image and sub-page stay')
		assert.equal(calls.appended.length, 1)
		assert.deepEqual(calls.appended[0]!.children.map(block => block.type), ['heading_1'])
		assert.equal(calls.updates.length, 0)
		assert.equal(existing.description, '# New plan')
		assert.equal(twin.description, '# New plan')
	})

	it('rejects creating a recurring task', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Weekly', recurrence: new Recurrence({ freq: 'WEEKLY' }) })
		await assert.rejects(() => integration.createEntry(em, entry), /recurring/)
	})

	it('writes only the diffed properties and mirrors the write onto the sibling view\'s row', async () => {
		const em = orm.em.fork()
		const { integration, source, sibling, calls } = await seed(em, {
			updateEcho: page('p1', { title: 'Renamed', status: 'o-doing', editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const existing = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p1', type: EntryType.Task, heading: 'Original', status: TaskStatus.Doing })
		const twin = new Entry({ id: crypto.randomUUID(), sourceId: sibling.id, uri: 'p1', type: EntryType.Task, heading: 'Original', status: TaskStatus.Doing })
		em.persist([existing, twin])
		await em.flush()

		const incoming = new Entry({ sourceId: source.id, type: EntryType.Task, heading: 'Renamed', status: TaskStatus.Doing })
		await integration.updateEntry(em, existing, incoming)
		await em.flush()

		assert.equal(calls.updates.length, 1)
		assert.deepEqual(Object.keys(calls.updates[0]!.properties), ['Name'])
		assert.equal(twin.heading, 'Renamed')
	})

	it('does not call Notion at all when nothing mapped changed', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {})
		const existing = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p1', type: EntryType.Task, heading: 'Same', status: TaskStatus.ToDo })
		em.persist(existing)
		await em.flush()
		await integration.updateEntry(em, existing, existing.clone())
		assert.equal(calls.updates.length, 0)
	})

	it('trashes the page and removes every view\'s row of it', async () => {
		const em = orm.em.fork()
		const { integration, source, sibling, calls } = await seed(em, {})
		const existing = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p1', type: EntryType.Task, heading: 'Doomed' })
		const twin = new Entry({ id: crypto.randomUUID(), sourceId: sibling.id, uri: 'p1', type: EntryType.Task, heading: 'Doomed' })
		em.persist([existing, twin])
		await em.flush()

		await integration.deleteEntry(em, existing)
		await em.flush()
		assert.deepEqual(calls.trashed, ['p1'])
		assert.equal(await em.count(Entry, { uri: 'p1', sourceId: { $in: [source.id, sibling.id] } }), 0)
	})

	it('treats an already-gone page as deleted, not as an error', async () => {
		const em = orm.em.fork()
		const { NotionRequestError } = await import('../NotionClient.js')
		const { integration, source } = await seed(em, { trashError: new NotionRequestError(404, 'object_not_found', 'gone') })
		const existing = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p1', type: EntryType.Task, heading: 'Already gone' })
		em.persist(existing)
		await em.flush()
		await integration.deleteEntry(em, existing)
		await em.flush()
		assert.equal(await em.count(Entry, { uri: 'p1', sourceId: source.id }), 0)
	})
})

describe('Notion relationships', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	const rowsOf = (em: EntityManager, entry: Entry) => em.find(EntryRelation, { entryId: entry.id }, { orderBy: { targetUid: 'asc' } })

	it('parses the mapped relation properties into rows, with the PAGE ID as the entry\'s uid', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			members: { ids: ['p-95', 'p-94'], complete: true },
			delta: [
				page('p-95', { title: 'Reach 95.5 kg', parent: ['p-goal'] }),
				page('p-94', { title: 'Reach 94 kg', parent: ['p-goal'], blockedBy: ['p-95'] }),
			],
		})

		await sync(integration, em, source)
		await em.flush()

		const dependent = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p-94' })
		assert.equal(dependent.uid, 'p-94')
		assert.deepEqual((await rowsOf(em, dependent)).map(row => [row.type.value, row.targetUid]), [
			['FINISHTOSTART', 'p-95'],
			['PARENT', 'p-goal'],
		])
		assert.deepEqual((await rowsOf(em, await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p-95' }))).map(row => row.type.value), ['PARENT'])
	})

	it('reports a relation-only remote change — it sits outside editEquals, so the sync compares it itself', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
		})
		await sync(integration, em, source)
		await em.flush()

		state.delta = [page('p1', { parent: ['p-goal'], editedAt: '2026-07-12T08:00:00.000Z' })]
		assert.equal(await sync(integration, em, source), true)
		await em.flush()
		assert.deepEqual((await rowsOf(em, await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' }))).map(row => row.targetUid), ['p-goal'])
	})

	it('drops a row for a link removed in Notion, and KEEPS the mitra-owned one Notion cannot hold', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [page('p1', { blockedBy: ['p2'] }), page('p2')],
		})
		await sync(integration, em, source)
		await em.flush()

		const entry = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })
		em.persist(new EntryRelation({ entryId: entry.id!, type: RelationType.Parent, targetUid: 'caldav-uid' }))
		await em.flush()

		state.delta = [page('p1', { editedAt: '2026-07-12T08:00:00.000Z' })]
		await sync(integration, em, source)
		await em.flush()

		assert.deepEqual((await rowsOf(em, entry)).map(row => row.targetUid), ['caldav-uid'])
	})

	it('completes a truncated relation value before parsing it — the 25-id cap must never look like a removal', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1', { blockedBy: ['p2'], truncated: true })],
			fullRelation: ['p2', 'p3'],
		})

		await sync(integration, em, source)
		await em.flush()

		assert.deepEqual(calls.relationDrains, [{ pageId: 'p1', propertyId: '%5CHMd' }])
		assert.deepEqual((await rowsOf(em, await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' }))).map(row => row.targetUid), ['p2', 'p3'])
	})

	it('leaves the rows untouched when a truncated value cannot be read at all', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1', { blockedBy: ['p2'] })],
		})
		await sync(integration, em, source)
		await em.flush()

		state.delta = [page('p1', { blockedBy: ['p2'], truncated: true, editedAt: '2026-07-12T08:00:00.000Z' })]
		state.relationError = new NotionRequestError(404, 'object_not_found', 'page not found')
		await sync(integration, em, source)
		await em.flush()

		assert.deepEqual((await rowsOf(em, await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' }))).map(row => row.targetUid), ['p2'])
	})

	it('writes an added relation into its own property, and rewrites no other', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [page('p1', { parent: ['p-goal'] }), page('p2')],
			updateEcho: page('p1', { parent: ['p-goal'], blockedBy: ['p2'], editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		await sync(integration, em, source)
		await em.flush()

		const existing = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })
		await EntryRelation.loadFor(em, [existing])
		const incoming = existing.clone()
		incoming.relations = EntryRelations.of(undefined, [...existing.relations ?? [], { type: RelationType.FinishToStart, targetUid: 'p2' }]).value
		await integration.updateEntry(em, existing, incoming)
		await em.flush()

		assert.equal(calls.updates.length, 1)
		assert.deepEqual(calls.updates[0]!.properties, { 'Blocked by': { relation: [{ id: 'p2' }] } })
		assert.equal(EntryRelations.of(undefined, existing.relations).equals(EntryRelations.of(undefined, incoming.relations)), true)
	})

	it('clears a property with an empty list when the last line of its kind goes', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [page('p1', { blockedBy: ['p2'] }), page('p2')],
			updateEcho: page('p1', { editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		await sync(integration, em, source)
		await em.flush()

		const existing = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })
		await EntryRelation.loadFor(em, [existing])
		const incoming = existing.clone()
		incoming.relations = null
		await integration.updateEntry(em, existing, incoming)
		await em.flush()

		assert.deepEqual(calls.updates[0]!.properties, { 'Blocked by': { relation: [] } })
	})

	it('never sends a link Notion cannot hold — it stays in the table alone', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
			updateEcho: page('p1', { editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		await sync(integration, em, source)
		await em.flush()

		const existing = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })
		await EntryRelation.loadFor(em, [existing])
		const incoming = existing.clone()
		incoming.relations = EntryRelations.of(undefined, [{ type: RelationType.Parent, targetUid: 'caldav-uid' }]).value
		await integration.updateEntry(em, existing, incoming)

		assert.equal(calls.updates.length, 0)
	})

	it('creates a page with the draft\'s relations already set', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			members: { ids: ['p2'], complete: true },
			delta: [page('p2')],
			createEcho: page('p-created', { parent: ['p2'], editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		await sync(integration, em, source)
		await em.flush()

		const draft = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'New task', status: TaskStatus.ToDo })
		draft.relations = EntryRelations.of(undefined, [{ type: RelationType.Parent, targetUid: 'p2' }]).value
		const created = await integration.createEntry(em, draft)
		await em.flush()

		assert.deepEqual(calls.updates[0]!.properties['Parent Task'], { relation: [{ id: 'p2' }] })
		assert.equal(created.uid, 'p-created')
		assert.deepEqual(created.relations?.map(relation => relation.targetUid), ['p2'])
	})

	it('re-points what pointed at an entry MOVED into Notion — Notion assigns the uid, so nothing may orphan', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			createEcho: page('p-created', { editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const moved = new Entry({ id: crypto.randomUUID(), uid: 'travelling-uid', sourceId: source.id, type: EntryType.Task, heading: 'Moved', status: TaskStatus.ToDo })
		const pointer = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Points at it' })
		em.persist([moved, pointer])
		em.persist(new EntryRelation({ entryId: pointer.id!, type: RelationType.FinishToStart, targetUid: 'travelling-uid' }))
		await em.flush()

		await integration.createEntry(em, moved)
		await em.flush()

		assert.equal(moved.uid, 'p-created')
		assert.deepEqual((await rowsOf(em, pointer)).map(row => row.targetUid), ['p-created'])
	})

	it('mirrors a relation write onto the sibling view\'s row, keeping that row\'s own mitra-owned link', async () => {
		const em = orm.em.fork()
		const { integration, source, sibling, state } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [page('p1'), page('p2')],
			updateEcho: page('p1', { blockedBy: ['p2'], editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		await sync(integration, em, source)
		await em.flush()
		sibling.enabled = true
		state.members = { ids: ['p1', 'p2'], complete: true }
		state.delta = [page('p1'), page('p2')]
		await sync(integration, em, sibling)
		await em.flush()

		const twin = await em.findOneOrFail(Entry, { sourceId: sibling.id, uri: 'p1' })
		em.persist(new EntryRelation({ entryId: twin.id!, type: RelationType.Parent, targetUid: 'caldav-uid' }))
		await em.flush()

		const existing = await em.findOneOrFail(Entry, { sourceId: source.id, uri: 'p1' })
		await EntryRelation.loadFor(em, [existing])
		const incoming = existing.clone()
		incoming.relations = EntryRelations.of(undefined, [{ type: RelationType.FinishToStart, targetUid: 'p2' }]).value
		await integration.updateEntry(em, existing, incoming)
		await em.flush()

		assert.deepEqual((await rowsOf(em, twin)).map(row => row.targetUid), ['caldav-uid', 'p2'])
	})
})

describe('Notion connect identity', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('rejects connecting the same workspace twice with a clear message instead of a constraint crash', async () => {
		const em = orm.em.fork()
		const { user } = await seed(em, {})

		const second = new Notion({ userId: user.id, credentials: { username: '', token: 'ntn_other' } })
		em.persist(second)
		;(second as any).client = stubClient({}).client
		await assert.rejects(
			() => second.applyAndSync(em, { credentials: { token: 'ntn_other' }, sources: [] } as any),
			/already connected/,
		)
	})
})

describe('Integration source reconciliation (name preservation)', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('keeps a user\'s local rename across a background sync cycle', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {})

		await integration.getSources(em)
		await em.flush()
		assert.equal(source.remoteName, 'Tasks · All')

		source.name = 'My custom name'
		await em.flush()

		await integration.getSources(em)
		await em.flush()
		assert.equal(source.name, 'My custom name')
	})

	it('preserves a rename made before the remoteName baseline existed (the upgrade case)', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {})

		source.name = 'My custom name'
		source.remoteName = null
		await em.flush()

		await integration.getSources(em)
		await em.flush()
		assert.equal(source.name, 'My custom name')
		assert.equal(source.remoteName, 'Tasks · All')
	})

	it('enables the ticked sources of a plain, uri-keyed request body', async () => {
		const em = orm.em.fork()
		const { integration, source, sibling } = await seed(em, {})
		const body = { credentials: { token: '' }, sources: [
			{ uri: sibling.uri, enabled: true },
			{ uri: source.uri, enabled: false },
		] }
		await integration.applyAndSync(em, structuredClone(body) as never)
		assert.equal(sibling.enabled, true)
		assert.equal(source.enabled, false)
		assert.deepEqual([...sibling.entryTypes], [EntryType.Task])
	})

	it('refreshes the entry types a source declares from the provider on every reconcile', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {})
		source.entryTypes = [EntryType.Event]
		await em.flush()
		await integration.getSources(em)
		await em.flush()
		assert.deepEqual([...source.entryTypes], [EntryType.Task])
	})

	it('still adopts a rename made at the provider (a local custom name yields to it)', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {})
		await integration.getSources(em)
		await em.flush()

		source.name = 'My custom name'
		await em.flush()

		state.views = [
			{ object: 'view', id: 'view-1', name: 'Active', type: 'table' },
			{ object: 'view', id: 'view-2', name: 'Board', type: 'board' },
		]
		await integration.getSources(em)
		await em.flush()
		assert.equal(source.name, 'Tasks · Active')
		assert.equal(source.remoteName, 'Tasks · Active')
	})
})
