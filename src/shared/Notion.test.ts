import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Notion } from './Notion.js'
import { Entry, EntryType, TaskStatus, FLOATING_TIME_ZONE } from './Entry.js'
import { Source, SourceType } from './Source.js'
import { type NotionDataSource, type NotionPage } from './NotionClient.js'

type DateTime = import('@3mo/date-time').DateTime
const D = (iso: string) => new Date(iso) as unknown as DateTime

/** A task database's schema the way GET /data_sources/{id} serves it: a status property whose
 * options live in the three fixed groups (incl. a second "Shipped" option in Complete, to pin that
 * reads map by group and writes never rename it), a date property, and a decoy earlier date
 * property ("Created") that conventional naming must lose against. */
const dataSource = (overrides?: Partial<NotionDataSource>): NotionDataSource => ({
	object: 'data_source',
	id: 'ds-1',
	title: [{ plain_text: 'Tasks' }],
	properties: {
		'Name': { id: 'title', name: 'Name', type: 'title' },
		'Created': { id: 'created', name: 'Created', type: 'date' },
		'Status': {
			id: 'st', name: 'Status', type: 'status', status: {
				options: [
					{ id: 'o-not-started', name: 'Not started' },
					{ id: 'o-doing', name: 'In progress' },
					{ id: 'o-done', name: 'Done' },
					{ id: 'o-shipped', name: 'Shipped' },
				],
				groups: [
					{ id: 'g-todo', name: 'To-do', option_ids: ['o-not-started'] },
					{ id: 'g-doing', name: 'In progress', option_ids: ['o-doing'] },
					{ id: 'g-done', name: 'Complete', option_ids: ['o-done', 'o-shipped'] },
				],
			},
		},
		'Due': { id: 'due', name: 'Due', type: 'date' },
		// A non-mapped select the way a "University" view filters on it (referenced by id in filters).
		'Area': { id: 'area%3F', name: 'Area', type: 'select' },
		'Pinned': { id: 'pin', name: 'Pinned', type: 'checkbox' },
	},
	...overrides,
})

const schema = () => Notion.schemaIndexOf(dataSource())!

const page = (init?: Partial<NotionPage>): NotionPage => ({
	object: 'page',
	id: 'page-1',
	last_edited_time: '2026-07-14T10:00:00.000Z',
	url: 'https://www.notion.so/page-1',
	properties: {
		'Name': { type: 'title', title: [{ plain_text: 'Ship the release' }] },
		'Status': { type: 'status', status: { id: 'o-doing', name: 'In progress' } },
		'Due': { type: 'date', date: { start: '2026-07-15', end: null, time_zone: null } },
	},
	...init,
})

describe('Notion source uris', () => {
	it('encodes the data source and view ids (stable under renames) and reads them back', () => {
		const uri = Notion.sourceUri('ds-1', 'view-1')
		assert.equal(uri, 'notion://ds-1/view-1')
		assert.deepEqual(Notion.idsOf({ uri }), { dataSourceId: 'ds-1', viewId: 'view-1' })
	})

	it('rejects a uri that is not a Notion source', () => {
		assert.throws(() => Notion.idsOf({ uri: 'https://caldav.example.com/cal/' }), /Not a Notion source uri/)
	})
})

describe('Notion.schemaIndexOf', () => {
	it('resolves the title, status and date properties of a task database', () => {
		const index = schema()
		assert.equal(index.titleProperty, 'Name')
		assert.equal(index.statusProperty, 'Status')
		assert.equal(index.dateProperty, 'Due')
	})

	it('prefers a conventionally-named date property over an earlier decoy', () => {
		// "Created" comes first in the schema map, but "Due" is the scheduling property.
		assert.equal(schema().dateProperty, 'Due')
	})

	it('maps every status option to its group\'s task status', () => {
		const index = schema()
		assert.equal(index.statusByOption.get('o-not-started'), TaskStatus.ToDo)
		assert.equal(index.statusByOption.get('o-doing'), TaskStatus.Doing)
		assert.equal(index.statusByOption.get('o-done'), TaskStatus.Done)
		assert.equal(index.statusByOption.get('o-shipped'), TaskStatus.Done)
	})

	it('writes each status as its group\'s FIRST option', () => {
		const index = schema()
		assert.equal(index.optionByStatus.get(TaskStatus.ToDo), 'o-not-started')
		assert.equal(index.optionByStatus.get(TaskStatus.Doing), 'o-doing')
		assert.equal(index.optionByStatus.get(TaskStatus.Done), 'o-done')
		// The fourth status has no Notion group — deliberately unwritable.
		assert.equal(index.optionByStatus.get(TaskStatus.Cancelled), undefined)
	})

	it('falls back to group POSITION when a group arrives under a non-canonical name', () => {
		const source = dataSource()
		source.properties['Status']!.status!.groups = [
			{ id: 'g1', name: 'Backlog?', option_ids: ['o-not-started'] },
			{ id: 'g2', name: 'Mid', option_ids: ['o-doing'] },
			{ id: 'g3', name: 'Finished', option_ids: ['o-done'] },
		]
		const index = Notion.schemaIndexOf(source)!
		assert.equal(index.statusByOption.get('o-not-started'), TaskStatus.ToDo)
		assert.equal(index.statusByOption.get('o-doing'), TaskStatus.Doing)
		assert.equal(index.statusByOption.get('o-done'), TaskStatus.Done)
	})

	it('disqualifies a database without a status property (not a task database)', () => {
		const source = dataSource()
		delete source.properties['Status']
		assert.equal(Notion.schemaIndexOf(source), undefined)
	})

	it('disqualifies a database without a date property (not schedulable)', () => {
		const source = dataSource()
		delete source.properties['Due']
		delete source.properties['Created']
		assert.equal(Notion.schemaIndexOf(source), undefined)
	})
})

describe('Notion.deriveFilterDefaults', () => {
	it('sets a select property the view filters on, resolving the filter\'s property ID to its name', () => {
		// The "University" view: Area = University, referenced by url-encoded property id (as saved filters do).
		const defaults = Notion.deriveFilterDefaults({ filter: { property: 'area%3F', select: { equals: 'University' } } }, dataSource())
		assert.deepEqual(defaults, { Area: { select: { name: 'University' } } })
	})

	it('resolves a filter that references the property by name too', () => {
		const defaults = Notion.deriveFilterDefaults({ filter: { property: 'Area', select: { equals: 'University' } } }, dataSource())
		assert.deepEqual(defaults, { Area: { select: { name: 'University' } } })
	})

	it('satisfies every conjunct of an AND filter', () => {
		const defaults = Notion.deriveFilterDefaults({ filter: {
			and: [
				{ property: 'Area', select: { equals: 'University' } },
				{ property: 'Pinned', checkbox: { equals: true } },
			],
		} }, dataSource())
		assert.deepEqual(defaults, { Area: { select: { name: 'University' } }, Pinned: { checkbox: true } })
	})

	it('leaves an OR group alone — which branch to satisfy would be a guess', () => {
		const defaults = Notion.deriveFilterDefaults({ filter: {
			or: [
				{ property: 'Area', select: { equals: 'University' } },
				{ property: 'Area', select: { equals: 'Work' } },
			],
		} }, dataSource())
		assert.deepEqual(defaults, {})
	})

	it('satisfies the AND conjuncts around a nested OR while skipping the OR itself', () => {
		const defaults = Notion.deriveFilterDefaults({ filter: {
			and: [
				{ property: 'Area', select: { equals: 'University' } },
				{ or: [{ property: 'Pinned', checkbox: { equals: true } }, { property: 'Pinned', checkbox: { equals: false } }] },
			],
		} }, dataSource())
		assert.deepEqual(defaults, { Area: { select: { name: 'University' } } })
	})

	it('reads quick_filters (where real task views keep their filtering, with raw property ids)', () => {
		// The University view has filter:null and everything in quick_filters, keyed by the RAW id.
		const defaults = Notion.deriveFilterDefaults({ filter: null as any, quick_filters: {
			'area?': { select: { equals: 'University' } }, // raw id `area?` ↔ schema id `area%3F`
		} }, dataSource())
		assert.deepEqual(defaults, { Area: { select: { name: 'University' } } })
	})

	it('points a relation at the page a "relation contains" filter names ("Area = University" as a relation)', () => {
		const source = dataSource()
		source.properties['AreaRel'] = { id: 'arel', name: 'AreaRel', type: 'relation' }
		const defaults = Notion.deriveFilterDefaults({ quick_filters: {
			'arel': { relation: { contains: 'university-page-id' } },
		} }, source)
		assert.deepEqual(defaults, { AreaRel: { relation: [{ id: 'university-page-id' }] } })
	})

	it('skips a filter on a since-deleted property (the University view\'s stale relation) rather than guessing', () => {
		// `]{OQ` resolves to no current schema property → no write, no crash.
		const defaults = Notion.deriveFilterDefaults({ quick_filters: {
			']{OQ': { relation: { contains: 'some-page' } },
		} }, dataSource())
		assert.deepEqual(defaults, {})
	})

	it('skips does_not_equal / formula quick_filters (no single value satisfies them)', () => {
		const defaults = Notion.deriveFilterDefaults({ quick_filters: {
			'MVsK': { status: { does_not_equal: 'Complete' } } as any,
			'`jqp': { formula: { checkbox: { equals: true } } } as any,
		} }, dataSource())
		assert.deepEqual(defaults, {})
	})

	it('writes a real status option the view filters on, but skips a status GROUP name (not a writable option)', () => {
		const byOption = Notion.deriveFilterDefaults({ filter: { property: 'Status', status: { equals: 'Shipped' } } }, dataSource())
		assert.deepEqual(byOption, { Status: { status: { name: 'Shipped' } } })
		// "Complete" is a GROUP, not an option — unwritable, so it's skipped rather than failing the create.
		const byGroup = Notion.deriveFilterDefaults({ filter: { property: 'Status', status: { equals: 'Complete' } } }, dataSource())
		assert.deepEqual(byGroup, {})
	})

	it('adds a multi_select option via contains', () => {
		const source = dataSource()
		source.properties['Tags'] = { id: 'tags', name: 'Tags', type: 'multi_select' }
		const defaults = Notion.deriveFilterDefaults({ filter: { property: 'Tags', multi_select: { contains: 'urgent' } } }, source)
		assert.deepEqual(defaults, { Tags: { multi_select: [{ name: 'urgent' }] } })
	})

	it('skips a condition no single value can satisfy, and an unknown property', () => {
		// A date-range / is-not-empty style condition mitra doesn't model → ignored (undefined operator).
		assert.deepEqual(Notion.deriveFilterDefaults({ filter: { property: 'Due' } as any }, dataSource()), {})
		assert.deepEqual(Notion.deriveFilterDefaults({ filter: { property: 'Nonexistent', select: { equals: 'x' } } }, dataSource()), {})
	})

	it('returns nothing for a view with no filter or quick_filters', () => {
		assert.deepEqual(Notion.deriveFilterDefaults(undefined, dataSource()), {})
		assert.deepEqual(Notion.deriveFilterDefaults({ filter: null as any }, dataSource()), {})
	})
})

describe('Notion date decoding (spanFrom)', () => {
	it('reads a date-only value as a canonical all-day day (UTC midnights, exclusive end)', () => {
		const span = Notion.spanFrom({ start: '2026-06-02', end: null, time_zone: null })
		assert.equal(span.allDay, true)
		assert.equal(span.start!.toISOString(), '2026-06-02T00:00:00.000Z')
		assert.equal(span.end!.toISOString(), '2026-06-03T00:00:00.000Z')
		assert.equal(span.timeZone, null)
	})

	it('reads a date-only range with Notion\'s INCLUSIVE end as the exclusive next midnight', () => {
		const span = Notion.spanFrom({ start: '2026-06-02', end: '2026-06-04' })
		assert.equal(span.end!.toISOString(), '2026-06-05T00:00:00.000Z')
	})

	it('reads a Z-suffixed date-time as the instant it pins, with no authoring zone', () => {
		const span = Notion.spanFrom({ start: '2026-07-14T09:00:00.000Z', end: null, time_zone: null })
		assert.equal(span.allDay, false)
		assert.equal(span.start!.toISOString(), '2026-07-14T09:00:00.000Z')
		assert.equal(span.end, undefined)
		assert.equal(span.timeZone, null)
	})

	it('reads an offset date-time as its instant', () => {
		const span = Notion.spanFrom({ start: '2026-07-14T09:00:00+02:00' })
		assert.equal(span.start!.toISOString(), '2026-07-14T07:00:00.000Z')
	})

	it('reads a wall-clock date-time in the value\'s time_zone, which becomes the authoring zone', () => {
		const span = Notion.spanFrom({ start: '2026-07-14T09:00:00', end: '2026-07-14T10:00:00', time_zone: 'Europe/Berlin' })
		assert.equal(span.start!.toISOString(), '2026-07-14T07:00:00.000Z') // 09:00 Berlin (CEST) = 07:00Z
		assert.equal(span.end!.toISOString(), '2026-07-14T08:00:00.000Z')
		assert.equal(span.timeZone, 'Europe/Berlin')
	})

	it('reads an unset date as an undated task', () => {
		assert.deepEqual(Notion.spanFrom(null), { start: undefined, end: undefined, allDay: false, timeZone: null })
		assert.deepEqual(Notion.spanFrom(undefined), { start: undefined, end: undefined, allDay: false, timeZone: null })
	})
})

describe('Notion date encoding (dateFrom)', () => {
	it('writes a single all-day day date-only, with no end', () => {
		const date = Notion.dateFrom({ start: D('2026-06-02T00:00:00Z'), end: D('2026-06-03T00:00:00Z'), allDay: true, timeZone: null })
		assert.deepEqual(date, { start: '2026-06-02', end: null, time_zone: null })
	})

	it('writes a multi-day all-day span with the INCLUSIVE last day as end', () => {
		const date = Notion.dateFrom({ start: D('2026-06-02T00:00:00Z'), end: D('2026-06-05T00:00:00Z'), allDay: true, timeZone: null })
		assert.deepEqual(date, { start: '2026-06-02', end: '2026-06-04', time_zone: null })
	})

	it('writes an unzoned timed span in the Z form', () => {
		const date = Notion.dateFrom({ start: D('2026-07-14T07:00:00Z'), end: D('2026-07-14T08:00:00Z'), allDay: false, timeZone: null })
		assert.deepEqual(date, { start: '2026-07-14T07:00:00.000Z', end: '2026-07-14T08:00:00.000Z', time_zone: null })
	})

	it('writes a zoned timed span as that zone\'s wall clock under time_zone', () => {
		const date = Notion.dateFrom({ start: D('2026-07-14T07:00:00Z'), end: D('2026-07-14T08:00:00Z'), allDay: false, timeZone: 'Europe/Berlin' })
		assert.deepEqual(date, { start: '2026-07-14T09:00:00', end: '2026-07-14T10:00:00', time_zone: 'Europe/Berlin' })
	})

	it('writes a FLOATING entry\'s as-if-UTC instants in the Z form, never the reserved marker', () => {
		const date = Notion.dateFrom({ start: D('2026-07-14T09:00:00Z'), end: undefined, allDay: false, timeZone: FLOATING_TIME_ZONE })
		assert.deepEqual(date, { start: '2026-07-14T09:00:00.000Z', end: null, time_zone: null })
	})

	it('writes an undated task as null (clearing the property)', () => {
		assert.equal(Notion.dateFrom({ start: undefined, end: undefined, allDay: false, timeZone: null }), null)
	})

	it('round-trips through spanFrom in both the all-day and the zoned form', () => {
		const allDay = { start: D('2026-06-02T00:00:00Z'), end: D('2026-06-05T00:00:00Z'), allDay: true, timeZone: null }
		const zoned = { start: D('2026-07-14T07:00:00Z'), end: D('2026-07-14T08:00:00Z'), allDay: false, timeZone: 'Europe/Berlin' }
		for (const span of [allDay, zoned]) {
			const back = Notion.spanFrom(Notion.dateFrom(span))
			assert.equal(back.start!.toISOString(), (span.start as unknown as Date).toISOString())
			assert.equal(back.end!.toISOString(), (span.end as unknown as Date).toISOString())
			assert.equal(back.allDay, span.allDay)
			assert.equal(back.timeZone, span.timeZone)
		}
	})
})

describe('Notion property writes (propertiesFrom)', () => {
	const entry = (init?: Partial<Entry>) => new Entry({
		type: EntryType.Task,
		heading: 'Ship the release',
		status: TaskStatus.Done,
		start: D('2026-07-15T00:00:00Z'),
		end: D('2026-07-16T00:00:00Z'),
		allDay: true,
		...init,
	})

	it('writes title, status (by option id) and date on create', () => {
		const properties = Notion.propertiesFrom(entry(), schema())
		assert.deepEqual(properties['Name'], { title: [{ text: { content: 'Ship the release' } }] })
		assert.deepEqual(properties['Status'], { status: { id: 'o-done' } })
		assert.deepEqual(properties['Due'], { date: { start: '2026-07-15', end: null, time_zone: null } })
	})

	it('scopes an update to the changed properties only — an untouched status is never rewritten', () => {
		const properties = Notion.propertiesFrom(entry(), schema(), { heading: true, status: false, span: false })
		assert.deepEqual(Object.keys(properties), ['Name'])
	})

	it('omits an undefined status (keeps the remote value) rather than inventing one', () => {
		const properties = Notion.propertiesFrom(entry({ status: undefined }), schema())
		assert.equal(properties['Status'], undefined)
	})

	it('rejects the cancelled status — Notion has no group for it', () => {
		assert.throws(() => Notion.propertiesFrom(entry({ status: TaskStatus.Cancelled }), schema()), /cancelled/)
	})

	it('rejects a status whose group has no options to write', () => {
		const source = dataSource()
		source.properties['Status']!.status!.groups[1] = { id: 'g-doing', name: 'In progress', option_ids: [] }
		assert.throws(() => Notion.propertiesFrom(entry({ status: TaskStatus.Doing }), Notion.schemaIndexOf(source)!), /no option/)
	})
})

describe('Notion page reads (applyPage)', () => {
	it('maps title, status group, date and bookkeeping onto the entry', () => {
		const entry = new Entry({ id: 'e1', sourceId: 's1' })
		Notion.applyPage(entry, page(), schema())
		assert.equal(entry.type, EntryType.Task)
		assert.equal(entry.uri, 'page-1')
		assert.equal(entry.heading, 'Ship the release')
		assert.equal(entry.status, TaskStatus.Doing)
		assert.equal(entry.allDay, true)
		assert.equal((entry.start as unknown as Date).toISOString(), '2026-07-15T00:00:00.000Z')
		assert.deepEqual(entry.data, { etag: '2026-07-14T10:00:00.000Z', url: 'https://www.notion.so/page-1' })
	})

	it('reads a non-default option ("Shipped") as its group\'s status', () => {
		const entry = new Entry({ id: 'e1', sourceId: 's1' })
		const shipped = page()
		shipped.properties['Status'] = { type: 'status', status: { id: 'o-shipped', name: 'Shipped' } }
		Notion.applyPage(entry, shipped, schema())
		assert.equal(entry.status, TaskStatus.Done)
	})

	it('falls back to To Do for a missing or unknown status option', () => {
		const entry = new Entry({ id: 'e1', sourceId: 's1' })
		const statusless = page()
		statusless.properties['Status'] = { type: 'status', status: null }
		Notion.applyPage(entry, statusless, schema())
		assert.equal(entry.status, TaskStatus.ToDo)
	})

	it('clears what Notion cannot hold, so a re-import never leaves stale leftovers', () => {
		const entry = new Entry({
			id: 'e1', sourceId: 's1',
			description: 'left over', location: 'somewhere', color: '#123456',
			reminders: [30],
		})
		Notion.applyPage(entry, page(), schema())
		assert.equal(entry.description, '')
		assert.equal(entry.location, '')
		assert.equal(entry.color, null)
		assert.equal(entry.reminders, null)
		assert.equal(entry.recurrence, null)
	})

	it('labels an untitled page rather than syncing an empty heading', () => {
		const entry = new Entry({ id: 'e1', sourceId: 's1' })
		const untitled = page()
		untitled.properties['Name'] = { type: 'title', title: [] }
		Notion.applyPage(entry, untitled, schema())
		assert.equal(entry.heading, 'Untitled Task')
	})
})

describe('Notion integration model', () => {
	const account = () => new Notion({
		uri: 'notion://bot-1',
		credentials: { username: 'Acme Workspace', token: 'ntn_secret' },
		sources: [new Source({ uri: 'notion://ds-1/view-1', type: SourceType.Task, name: 'Tasks · All', enabled: true })] as any,
	})

	it('declares what Notion cannot represent — the editor hides these fields', () => {
		// timeZone:false — Notion's date property can't hold a named IANA zone (its API resolves any
		// time_zone to a fixed offset and returns time_zone:null), so the zone picker/lens is hidden.
		assert.deepEqual(account().capabilities, { recurrence: false, reminders: false, location: false, description: false, cancelledStatus: false, timeZone: false })
	})

	it('keeps the stored token when the edit form leaves it blank, and never takes a client label', () => {
		const integration = account()
		integration.merge(new Notion({ credentials: { username: 'spoofed', token: '' } }))
		assert.deepEqual(integration.credentials, { username: 'Acme Workspace', token: 'ntn_secret' })
	})

	it('rotates the token when the edit form carries a new one', () => {
		const integration = account()
		integration.merge(new Notion({ credentials: { username: '', token: 'ntn_rotated' } }))
		assert.equal(integration.credentials.token, 'ntn_rotated')
	})

	it('serves the workspace label but never the token', () => {
		const json = JSON.parse(JSON.stringify(account()))
		assert.equal(json['@type'], 'Notion')
		assert.deepEqual(json.credentials, { username: 'Acme Workspace' })
	})

	it('is a polymorphic editable copy with the token blanked', () => {
		const copy = account().editableCopy()
		assert.ok(copy instanceof Notion)
		assert.deepEqual(copy.credentials, { username: 'Acme Workspace', token: '' })
		assert.ok(Array.isArray(copy.sources))
	})

	it('polls politely (Notion allows ~3 requests/second per connection)', () => {
		assert.ok(account().syncInterval >= 60_000)
	})

	it('rejects recurring tasks at every write — Notion has no repeat concept', async () => {
		await assert.rejects(() => account().excludeOccurrence(), /recurring/)
	})

	it('offers only views that hold plain task rows as sources', () => {
		assert.ok(Notion.isSourceView({ object: 'view', id: 'v', type: 'board' }))
		assert.ok(Notion.isSourceView({ object: 'view', id: 'v', type: 'calendar' }))
		assert.ok(!Notion.isSourceView({ object: 'view', id: 'v', type: 'form' }))
		assert.ok(!Notion.isSourceView({ object: 'view', id: 'v', type: 'chart' }))
	})
})
