import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MikroORM, UnderscoreNamingStrategy, type EntityManager } from '@mikro-orm/sqlite'
import { User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Source, SourceType, Entry, EntryType, TaskStatus, Recurrence } from '../shared/index.js'
import { type NotionBlock, type NotionClient, type NotionDataSource, type NotionPage } from '../shared/NotionClient.js'
import { Dev } from './Dev.js'
import { NotificationSubscription } from './NotificationSubscription.js'
import { Session } from './Session.js'

// The Notion sync pipeline against real SQLite: full-membership deletions (and their two safety
// guards), incremental-content upserts, the field-compare `changed` contract, write mirroring onto
// sibling view rows, and the duplicate-connect guard. The network is a stub client injected into the
// integration's memo slot — the exact seam `Notion.createClient` exists for.

async function inMemoryOrm() {
	const orm = await MikroORM.init({
		entities: [User, Identity, Integration, CalDAV, GoogleCalendar, AppleCalendar, Notion, Dev, Source, Entry, Recurrence, NotificationSubscription, Session],
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
	},
})

const page = (id: string, init?: { title?: string, status?: string, date?: string | null, editedAt?: string, inTrash?: boolean }): NotionPage => ({
	object: 'page',
	id,
	last_edited_time: init?.editedAt ?? '2026-07-10T10:00:00.000Z',
	in_trash: init?.inTrash,
	url: `https://www.notion.so/${id}`,
	properties: {
		'Name': { type: 'title', title: [{ plain_text: init?.title ?? `Task ${id}` }] },
		'Status': { type: 'status', status: { id: init?.status ?? 'o-todo', name: '' } },
		'Due': { type: 'date', date: init?.date === null ? null : { start: init?.date ?? '2026-07-15', end: null, time_zone: null } },
	},
})

interface StubState {
	members?: { ids: Array<string>, complete: boolean }
	delta?: Array<NotionPage>
	byId?: Record<string, NotionPage>
	/** Page-body blocks by parent block id — what blockChildren serves (default: empty bodies). */
	bodies?: Record<string, Array<NotionBlock>>
	updateEcho?: NotionPage
	createEcho?: NotionPage
	trashError?: Error
	viewFilter?: unknown
	viewQuickFilters?: unknown
	/** Overrides the discovered view list (keep the ids stable to keep source keys stable — change a
	 * `name` to simulate a REMOTE rename). */
	views?: Array<{ object: string, id: string, name: string, type: string }>
}

/** The endpoints the code under test touches, recording writes for assertions. */
function stubClient(state: StubState) {
	const calls = {
		updates: new Array<{ pageId: string, properties: Record<string, unknown> }>(),
		trashed: new Array<string>(),
		individuallyFetched: new Array<string>(),
		deletedBlocks: new Array<string>(),
		appended: new Array<{ blockId: string, children: Array<NotionBlock> }>(),
		createChildren: new Array<NotionBlock>(),
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

/** A user owning a Notion integration with the stub wired into the client memo. `view-2` is the
 * sibling view of the same database — disabled unless a test enables it. */
async function seed(em: EntityManager, state: StubState) {
	const user = new User({ username: `alice-${crypto.randomUUID()}` })
	const integration = new Notion({ userId: user.id, uri: 'notion://bot-1', credentials: { username: 'Acme', token: 'ntn_secret' } })
	const source = new Source({ integrationId: integration.id, uri: 'notion://ds-1/view-1', type: SourceType.Task, name: 'Tasks · All', enabled: true, hidden: false })
	const sibling = new Source({ integrationId: integration.id, uri: 'notion://ds-1/view-2', type: SourceType.Task, name: 'Tasks · Board', enabled: false, hidden: false })
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
		assert.equal(await sync(integration, em, source), true) // first sight — a real change
		await em.flush()
		assert.equal(await sync(integration, em, source), false) // identical re-serve — no notify
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

		// A row mitra just created (localWriteAt stamped on our own clock): its page id is not yet in
		// the (lagging) membership, so the deletion pass must spare it.
		const fresh = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p-fresh', type: EntryType.Task, heading: 'Just created', data: { localWriteAt: Date.now() } })
		em.persist(fresh)
		await em.flush()

		state.delta = []
		await sync(integration, em, source)
		await em.flush()
		assert.ok(await em.findOne(Entry, { sourceId: source.id, uri: 'p-fresh' }), 'the just-created row must survive the membership set difference')
	})

	it('deletes a stale row whose write time has aged past the grace window', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
		})
		await sync(integration, em, source)
		await em.flush()

		// A row mitra wrote long ago (localWriteAt well outside the overlap window), no longer a member.
		const stale = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p-old', type: EntryType.Task, heading: 'Left the view', data: { localWriteAt: Date.now() - 10 * 60_000 } })
		em.persist(stale)
		await em.flush()

		state.delta = []
		await sync(integration, em, source)
		await em.flush()
		assert.equal(await em.findOne(Entry, { sourceId: source.id, uri: 'p-old' }), null, 'a row aged past the grace window and absent from the view is removed')
	})

	it('prunes a created task once it leaves (or never joins) the view — the source mirrors the view', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1'], complete: true },
			delta: [page('p1')],
		})
		await sync(integration, em, source)
		await em.flush()

		// A task created in mitra whose page doesn't match the view's filter (no University relation),
		// with an aged localWriteAt so the index-lag grace window doesn't apply. It is NOT retained:
		// membership is the single source of truth — no per-entry "created here" exception.
		const orphan = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p-mine', type: EntryType.Task, heading: 'Not a member', data: { localWriteAt: Date.now() - 10 * 60_000 } })
		em.persist(orphan)
		await em.flush()

		state.delta = []
		await sync(integration, em, source)
		await em.flush()
		assert.equal(await em.findOne(Entry, { sourceId: source.id, uri: 'p-mine' }), null, 'a row absent from the view membership is pruned, however it got here')
	})

	it('stamps a created entry with a local-clock write time so the next cycle spares it', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {
			createEcho: page('page-new', { title: 'Buy milk', editedAt: '2000-01-01T00:00:00.000Z' }), // ancient remote stamp
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Buy milk' })
		const before = Date.now()
		await integration.createEntry(em, entry)
		// The freshness clock is OURS, not the (ancient) remote last_edited_time — immune to clock skew.
		assert.ok((entry.data?.localWriteAt ?? 0) >= before, 'createEntry stamps localWriteAt on our own clock')
	})

	it('skips deletion detection entirely when the membership is truncated, but still applies edits', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {
			members: { ids: ['p1', 'p2'], complete: true },
			delta: [page('p1'), page('p2')],
		})
		await sync(integration, em, source)
		await em.flush()

		state.members = { ids: ['p1'], complete: false } // p2 fell off a TRUNCATED listing — not a deletion signal
		state.delta = [page('p1', { title: 'Edited meanwhile', editedAt: '2026-07-12T08:00:00.000Z' })]
		await sync(integration, em, source)
		await em.flush()
		const entries = await em.find(Entry, { sourceId: source.id })
		assert.equal(entries.length, 2, 'no row may be deleted off a truncated membership')
		assert.equal(entries.find(e => e.uri === 'p1')?.heading, 'Edited meanwhile')
	})

	it('fetches a member individually when it slid into the view without an edit', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			members: { ids: ['p-old'], complete: true },
			delta: [], // edited long before the watermark — the delta no longer carries it
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
					{ object: 'block', id: 'b2', type: 'embed' }, // not expressible in markdown — invisible
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

		// Same properties, same edit stamp — only the body differs (minute-rounded stamps can hide this).
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
			// The "University" view: Area = University (this is the bug the user hit — without it the
			// page is created but never appears in the view and the next sync prunes it).
			viewFilter: { property: 'area', select: { equals: 'University' } },
			createEcho: page('page-new', { title: 'Read chapter 3', editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Read chapter 3', status: TaskStatus.ToDo })
		await integration.createEntry(em, entry)
		const created = calls.updates.find(u => u.pageId === '(create)')!
		assert.deepEqual(created.properties['Area'], { select: { name: 'University' } })
		// The user's own mapped fields still ride along (title/status/date), not just the filter default.
		assert.ok(created.properties['Name'], 'title still written')
		assert.ok(created.properties['Status'], 'status still written')
	})

	it('pre-fills a relation the view filters on (the real "Area = University" shape) from quick_filters', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			viewQuickFilters: { area: { relation: { contains: 'university-page-id' } } }, // "area" resolves to the Area property
			createEcho: page('page-new', { editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		// Make "Area" a relation for this test (the seed's Area is a select; override the schema fetch).
		;(integration as any).client.dataSource = () => Promise.resolve({ object: 'data_source', id: 'ds-1', title: [{ plain_text: 'Tasks' }], properties: {
			Name: { id: 'title', name: 'Name', type: 'title' },
			Status: dataSource().properties['Status'],
			Due: { id: 'due', name: 'Due', type: 'date' },
			Area: { id: 'area', name: 'Area', type: 'relation' },
		} })
		;(integration as any).dataSources = undefined // reset the memo so the override is used
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Read chapter 3', status: TaskStatus.ToDo })
		await integration.createEntry(em, entry)
		const created = calls.updates.find(u => u.pageId === '(create)')!
		assert.deepEqual(created.properties['Area'], { relation: [{ id: 'university-page-id' }] })
	})

	it('lets the user\'s mapped status win over a status the view filters on', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, {
			// A "Done" view — but the user creates a To Do task. We must NOT rewrite their status to Done.
			viewFilter: { property: 'st', status: { equals: 'Done' } },
			createEcho: page('page-new', { editedAt: '2026-07-14T12:00:00.000Z' }),
		})
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Start reading', status: TaskStatus.ToDo })
		await integration.createEntry(em, entry)
		const created = calls.updates.find(u => u.pageId === '(create)')!
		// Status is the To-do group's option, not the filter's "Done" (the task simply won't show in that view).
		assert.deepEqual(created.properties['Status'], { status: { id: 'o-todo' } })
	})

	it('still creates the task when the view filter can\'t be read (best-effort pre-fill)', async () => {
		const em = orm.em.fork()
		const { integration, source, calls } = await seed(em, { createEcho: page('page-new', { editedAt: '2026-07-14T12:00:00.000Z' }) })
		;(integration as any).client.view = () => Promise.reject(new Error('view fetch hiccup'))
		const entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, type: EntryType.Task, heading: 'Resilient', status: TaskStatus.ToDo })
		const created = await integration.createEntry(em, entry) // must not throw
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
		// The stored description is the write's own normalized markdown, so the next sync stays silent.
		assert.equal(entry.description, '- [ ] draft slides')
	})

	it('replaces only the blocks the description showed — collaborative content it could not render survives', async () => {
		const em = orm.em.fork()
		const { integration, source, sibling, calls } = await seed(em, {
			byId: { p1: page('p1', { editedAt: '2026-07-14T12:00:00.000Z' }) },
			bodies: {
				p1: [
					{ object: 'block', id: 'b-para', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Old notes' }] } },
					{ object: 'block', id: 'b-image', type: 'image' }, // was invisible in the editor — must survive
					{ object: 'block', id: 'b-subpage', type: 'child_page', has_children: true }, // a whole sub-page — must survive
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
		assert.equal(calls.updates.length, 0, 'a description-only edit writes no page properties')
		assert.equal(existing.description, '# New plan')
		assert.equal(twin.description, '# New plan', 'the sibling view\'s row of the same page mirrors the body write')
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
		// The same page mirrored in both views (the sibling's row exists even while disabled).
		const existing = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p1', type: EntryType.Task, heading: 'Original', status: TaskStatus.Doing })
		const twin = new Entry({ id: crypto.randomUUID(), sourceId: sibling.id, uri: 'p1', type: EntryType.Task, heading: 'Original', status: TaskStatus.Doing })
		em.persist([existing, twin])
		await em.flush()

		const incoming = new Entry({ sourceId: source.id, type: EntryType.Task, heading: 'Renamed', status: TaskStatus.Doing })
		await integration.updateEntry(em, existing, incoming)
		await em.flush()

		assert.equal(calls.updates.length, 1)
		// Only the title changed — the status property must not ride along (it would rename a
		// finer-grained option to the group's first one).
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
		// Scoped to THIS integration's sources — another integration's row of the same page id
		// (another user's mirror of the same workspace, say) is not ours to delete.
		assert.equal(await em.count(Entry, { uri: 'p1', sourceId: { $in: [source.id, sibling.id] } }), 0)
	})

	it('treats an already-gone page as deleted, not as an error', async () => {
		const em = orm.em.fork()
		const { NotionRequestError } = await import('../shared/NotionClient.js')
		const { integration, source } = await seed(em, { trashError: new NotionRequestError(404, 'object_not_found', 'gone') })
		const existing = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: 'p1', type: EntryType.Task, heading: 'Already gone' })
		em.persist(existing)
		await em.flush()
		await integration.deleteEntry(em, existing)
		await em.flush()
		assert.equal(await em.count(Entry, { uri: 'p1', sourceId: source.id }), 0)
	})
})

describe('Notion connect identity', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('rejects connecting the same workspace twice with a clear message instead of a constraint crash', async () => {
		const em = orm.em.fork()
		const { user } = await seed(em, {}) // owns notion://bot-1 already

		const second = new Notion({ userId: user.id, credentials: { username: '', token: 'ntn_other' } })
		em.persist(second)
		;(second as any).client = stubClient({}).client // discovery resolves the SAME bot user
		await assert.rejects(
			() => second.applyAndSync(em, { credentials: { token: 'ntn_other' }, sources: [] } as any),
			/already connected/,
		)
	})
})

// The reconciliation logic under test lives in the base Integration.getSources — Notion is just a
// convenient concrete provider to drive it through (its fetchSources derives each source's name from
// the database title + view name).
describe('Integration source reconciliation (name preservation)', () => {
	let orm: MikroORM

	before(async () => { orm = await inMemoryOrm() })
	after(async () => { await orm.close(true) })

	it('keeps a user\'s local rename across a background sync cycle', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {})

		// The first reconcile records the provider's name as the baseline.
		await integration.getSources(em)
		await em.flush()
		assert.equal(source.remoteName, 'Tasks · All')

		// The user renames the source (PUT /sources/:id/name simply sets source.name).
		source.name = 'My custom name'
		await em.flush()

		// A later background sync reconciles again — the custom name must survive, not reset.
		await integration.getSources(em)
		await em.flush()
		assert.equal(source.name, 'My custom name', 'a local rename is not clobbered by a sync cycle')
	})

	it('preserves a rename made before the remoteName baseline existed (the upgrade case)', async () => {
		const em = orm.em.fork()
		const { integration, source } = await seed(em, {})

		// A row that predates the remoteName column: renamed locally, baseline still null.
		source.name = 'My custom name'
		source.remoteName = null
		await em.flush()

		// The first reconcile after upgrade must NOT reset it — it records the baseline silently.
		await integration.getSources(em)
		await em.flush()
		assert.equal(source.name, 'My custom name', 'a pre-existing rename is not reset on the first reconcile')
		assert.equal(source.remoteName, 'Tasks · All', 'the provider name is captured as the baseline for next time')
	})

	it('still adopts a rename made at the provider (a local custom name yields to it)', async () => {
		const em = orm.em.fork()
		const { integration, source, state } = await seed(em, {})
		await integration.getSources(em)
		await em.flush()

		source.name = 'My custom name' // renamed locally...
		await em.flush()

		// ...but now the VIEW itself is renamed in Notion (same id → same source key, new composite name).
		state.views = [
			{ object: 'view', id: 'view-1', name: 'Active', type: 'table' },
			{ object: 'view', id: 'view-2', name: 'Board', type: 'board' },
		]
		await integration.getSources(em)
		await em.flush()
		assert.equal(source.name, 'Tasks · Active', 'a provider rename propagates through')
		assert.equal(source.remoteName, 'Tasks · Active')
	})
})
