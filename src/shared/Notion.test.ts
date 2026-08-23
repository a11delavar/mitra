import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Notion } from './Notion.js'
import { Entry, TaskStatus, FLOATING_TIME_ZONE } from './Entry.js'
import { EntryType } from './EntryType.js'
import { Source } from './Source.js'
import { Relation } from './Relation.js'
import { EntryRelations } from './EntryRelations.js'
import { RelationType } from './RelationType.js'
import { type NotionDataSource, type NotionPage } from './NotionClient.js'
import { asBrowser, wireOf } from './wire.testing.js'

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
		// The relation properties verbatim from a real task database: two two-way self-references
		// (each a pair of synced twins, ids percent-encoded as Notion serves them) and one pointing
		// at ANOTHER database, which relates a task to something that is not an entry.
		'Parent Task': relationProperty('uXhq', 'Parent Task', 'Sub Tasks'),
		'Sub Tasks': relationProperty('VrqI', 'Sub Tasks', 'Parent Task'),
		'Blocked by': relationProperty('%5CHMd', 'Blocked by', 'Blocking'),
		'Blocking': relationProperty('%40n~I', 'Blocking', 'Blocked by'),
		'Project': { id: 'proj', name: 'Project', type: 'relation', relation: { data_source_id: 'ds-projects', database_id: 'db-projects', type: 'dual_property', dual_property: { synced_property_name: 'Tasks' } } },
	},
	...overrides,
})

/** A self-referencing relation property of the fixture database, with its synced twin. */
const relationProperty = (id: string, name: string, twin?: string) => ({
	id, name, type: 'relation',
	relation: {
		data_source_id: 'ds-1',
		database_id: 'db-1',
		type: twin ? 'dual_property' : 'single_property',
		...(twin ? { dual_property: { synced_property_name: twin } } : {}),
	},
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

describe('Notion relation properties (relationPropertiesOf)', () => {
	const namesAndTypes = (source: NotionDataSource) => Notion.relationPropertiesOf(source).map(property => [property.name, property.type.value])

	it('maps the end mitra STORES of each two-way relationship, and drops the synced twin', () => {
		// One Notion relationship is two synced properties; mitra stores one direction and derives the
		// reverse, so mapping both would double every edge — and leave the write path two places to go.
		assert.deepEqual(namesAndTypes(dataSource()), [
			['Parent Task', 'PARENT'],
			['Blocked by', 'FINISHTOSTART'],
		])
	})

	it('addresses a property by its percent-encoded schema id — what the property-item endpoint wants', () => {
		assert.equal(Notion.relationPropertiesOf(dataSource()).find(property => property.type === RelationType.FinishToStart)?.id, '%5CHMd')
	})

	it('ignores a relation into ANOTHER database — a task\'s "Project" is not a relationship between entries', () => {
		assert.equal(namesAndTypes(dataSource()).some(([name]) => name === 'Project'), false)
	})

	it('reads a lone "Sub Tasks" as the foreign CHILD direction, kept verbatim and interpreted on read', () => {
		const source = dataSource()
		delete source.properties['Parent Task']
		source.properties['Sub Tasks'] = relationProperty('VrqI', 'Sub Tasks') as never
		assert.deepEqual(namesAndTypes(source).find(([name]) => name === 'Sub Tasks'), ['Sub Tasks', 'CHILD'])
	})

	it('maps a lone "Blocking" to NOTHING — that end has no RELTYPE to be stored as', () => {
		// All four RFC 9253 temporal types are authored on the dependent, so the "blocks" direction is
		// the other page's line to own. Inventing one here would misstate who waits for whom.
		const source = dataSource()
		delete source.properties['Blocked by']
		source.properties['Blocking'] = relationProperty('%40n~I', 'Blocking') as never
		assert.deepEqual(namesAndTypes(source).some(([name]) => name === 'Blocking'), false)
	})

	it('carries an unconventionally-named self-relation as an opaque X- type instead of guessing a family', () => {
		const source = dataSource()
		source.properties['Linked Tasks'] = relationProperty('lnk', 'Linked Tasks') as never
		assert.deepEqual(namesAndTypes(source).find(([name]) => name === 'Linked Tasks'), ['Linked Tasks', 'X-NOTION-LINKED-TASKS'])
	})

	it('keeps ONE property per type, so a write always knows where a line goes', () => {
		const source = dataSource()
		source.properties['Parent Item'] = relationProperty('par2', 'Parent Item') as never
		assert.equal(namesAndTypes(source).filter(([, type]) => type === 'PARENT').length, 1)
	})

	it('finds nothing in a database whose relations are all foreign', () => {
		const source = dataSource()
		for (const name of ['Parent Task', 'Sub Tasks', 'Blocked by', 'Blocking']) {
			delete source.properties[name]
		}
		assert.deepEqual(Notion.relationPropertiesOf(source), [])
		assert.deepEqual(Notion.schemaIndexOf(source)!.relationProperties, [])
	})
})

describe('Notion relation reads (relationsFrom)', () => {
	const related = (init: { parent?: Array<string>, blockedBy?: Array<string>, blocking?: Array<string> }) => page({
		properties: {
			...page().properties,
			'Parent Task': { type: 'relation', relation: (init.parent ?? []).map(id => ({ id })) },
			'Blocked by': { type: 'relation', relation: (init.blockedBy ?? []).map(id => ({ id })) },
			'Blocking': { type: 'relation', relation: (init.blocking ?? []).map(id => ({ id })) },
		},
	})

	it('reads each mapped property as lines of its type, targeting the related PAGE IDS', () => {
		// Page ids are uids here (see applyPage) — that is what makes a Notion relation a mitra one.
		assert.deepEqual(Notion.relationsFrom(related({ parent: ['page-parent'], blockedBy: ['page-blocker'] }), schema())?.map(relation => [relation.type.value, relation.targetUid]), [
			['FINISHTOSTART', 'page-blocker'],
			['PARENT', 'page-parent'],
		])
	})

	it('ignores the synced twin — the same relationship read from its other end would double the edge', () => {
		assert.equal(Notion.relationsFrom(related({ blocking: ['page-dependent'] }), schema()), null)
	})

	it('reads a page with no relations as the canonical "none"', () => {
		assert.equal(Notion.relationsFrom(page(), schema()), null)
	})

	it('drops a page relating to ITSELF — a self-reference is meaningless, not an edge', () => {
		assert.equal(Notion.relationsFrom(related({ parent: ['page-1'] }), schema()), null)
	})

	it('carries the retained (mitra-owned) lines alongside Notion\'s own', () => {
		const retained = [new Relation({ type: RelationType.Parent, targetUid: 'caldav-uid' })]
		assert.deepEqual(Notion.relationsFrom(related({ blockedBy: ['page-blocker'] }), schema(), retained)?.map(relation => relation.targetUid), ['page-blocker', 'caldav-uid'])
	})
})

describe('Notion relation ownership (retainedRelations)', () => {
	const isPage = (uid: string) => uid.startsWith('page-')
	const relations = [
		new Relation({ type: RelationType.Parent, targetUid: 'page-parent' }),
		new Relation({ type: RelationType.FinishToStart, targetUid: 'caldav-uid' }),
		new Relation({ type: RelationType.of('X-DUPLICATE-OF'), targetUid: 'page-twin' }),
	]

	it('keeps what Notion cannot express — a cross-provider target and a type no property carries', () => {
		assert.deepEqual(Notion.retainedRelations(relations, schema(), isPage).map(relation => relation.targetUid), ['caldav-uid', 'page-twin'])
	})

	it('claims nothing for Notion in a database without relation properties', () => {
		const source = dataSource()
		for (const name of ['Parent Task', 'Sub Tasks', 'Blocked by', 'Blocking']) {
			delete source.properties[name]
		}
		assert.equal(Notion.retainedRelations(relations, Notion.schemaIndexOf(source)!, isPage).length, 3)
	})
})

describe('Notion relation writes (relationPropertiesFrom / changedRelationProperties)', () => {
	const isPage = (uid: string) => uid.startsWith('page-')
	const parentOf = (uid: string) => new Relation({ type: RelationType.Parent, targetUid: uid })

	it('writes each property\'s COMPLETE list — a relation property is stored wholesale', () => {
		const properties = Notion.relationPropertiesFrom([parentOf('page-a'), parentOf('page-b')], schema(), isPage)
		assert.deepEqual(properties['Parent Task'], { relation: [{ id: 'page-a' }, { id: 'page-b' }] })
		assert.deepEqual(properties['Blocked by'], { relation: [] })
	})

	it('never smuggles a line Notion cannot hold into a property', () => {
		assert.deepEqual(Notion.relationPropertiesFrom([parentOf('caldav-uid')], schema(), isPage)['Parent Task'], { relation: [] })
	})

	it('scopes an update to the properties whose list actually changed', () => {
		const changed = Notion.changedRelationProperties([parentOf('page-a')], [parentOf('page-a'), new Relation({ type: RelationType.FinishToStart, targetUid: 'page-b' })], schema(), isPage)
		assert.deepEqual(Object.keys(changed), ['Blocked by'])
		assert.deepEqual(changed['Blocked by'], { relation: [{ id: 'page-b' }] })
	})

	it('writes an EMPTY list to clear the last line of its kind', () => {
		const changed = Notion.changedRelationProperties([parentOf('page-a')], null, schema(), isPage)
		assert.deepEqual(changed, { 'Parent Task': { relation: [] } })
	})

	it('writes nothing when only an unwritable (mitra-owned) line changed', () => {
		assert.deepEqual(Notion.changedRelationProperties(null, [parentOf('caldav-uid')], schema(), isPage), {})
	})

	it('round-trips: writing a list and reading the echo back yields the same relations', () => {
		const relations = [parentOf('page-parent'), new Relation({ type: RelationType.FinishToStart, targetUid: 'page-blocker' })]
		const written = Notion.relationPropertiesFrom(relations, schema(), isPage)
		const echo = page({ properties: { ...page().properties, ...written } })
		assert.equal(EntryRelations.of(undefined, Notion.relationsFrom(echo, schema())).equals(EntryRelations.of(undefined, relations)), true)
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
		assert.equal(entry.description, '', 'a page object carries no body — without a fetched description there is none')
		assert.equal(entry.location, '')
		assert.equal(entry.color, null)
		assert.equal(entry.reminders, null)
		assert.equal(entry.recurrence, null)
	})

	it('applies the separately-fetched body markdown as the description', () => {
		const entry = new Entry({ id: 'e1', sourceId: 's1' })
		Notion.applyPage(entry, page(), schema(), { description: 'A **bold** plan' })
		assert.equal(entry.description, 'A **bold** plan')
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
		sources: [new Source({ uri: 'notion://ds-1/view-1', entryTypes: [EntryType.Task], name: 'Tasks · All', enabled: true })] as any,
	})

	it('declares what Notion cannot represent — the editor hides these fields', () => {
		// timeZone:false — Notion's date property can't hold a named IANA zone (its API resolves any
		// time_zone to a fixed offset and returns time_zone:null), so the zone picker/lens is hidden.
		// description:true — the page body maps to markdown (NotionMarkdown).
		// participants:false — a page has no invitees (people ≠ RFC 5545 group-scheduling).
		// percentComplete:false — Notion models status groups only, without percent-complete property.
		assert.deepEqual(account().capabilities, { recurrence: false, reminders: false, location: false, description: true, cancelledStatus: false, percentComplete: false, timeZone: false, participants: false, transparency: false, visibility: false, relations: true })
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

	describe('crossing the API', () => {
		it('answers with the workspace label but never the token', () => {
			const json = wireOf(account())

			assert.equal(json['@type'], 'Notion')
			assert.deepEqual(json.credentials, { username: 'Acme Workspace', token: '' })
		})

		// The other direction of the same rule, and the reason it is a rule about direction: the connect
		// dialog posts the very instance the user pasted the token into, and it has to arrive.
		it('delivers the token when it is the browser asking', () => {
			assert.equal(asBrowser(() => wireOf(account())).credentials.token, 'ntn_secret')
		})

		it('never carries a live connection', () => {
			const integration = account()
			integration['getClient']() // reaching for it is what creates it

			assert.equal('client' in wireOf(integration), false)
			assert.equal('dataSources' in wireOf(integration), false)
		})
	})

	it('is a polymorphic editable copy carrying the credentials as held', () => {
		// As the client holds them — the token already withheld by the server that answered (see the
		// `@converter` on `credentials`), and blank is exactly what `merge` reads as "keep the stored one".
		const held = new Notion({ ...account(), credentials: { username: 'Acme Workspace', token: '' } })
		const copy = held.editableCopy()

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
