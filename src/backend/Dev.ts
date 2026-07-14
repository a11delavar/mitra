import { type EntityManager, type MikroORM } from '@mikro-orm/sqlite'
import { DateTime } from '@3mo/date-time'
import { model, entity, Integration, Source, SourceType, Entry, EntryType, TaskStatus, User, Color, normalizeAllDay, Recurrence, EntryRelation, RelationType } from '../shared/index.js'

/**
 * A dev-only, self-contained calendar with no external backend: its sources and entries live only in
 * our database, so every operation is a direct local persist/remove and there is nothing to sync. It
 * exists so the app renders without a real account; because it's a genuine persisted integration,
 * hiding sources / editing / creating / deleting all work through the normal routes (unlike a
 * read-only response overlay). `sync()` is overridden to a no-op so the base `getSources` doesn't treat
 * the empty remote list as "everything vanished" and delete the locally-owned sources.
 */
@model('Dev')
@entity({ discriminatorValue: 'dev' })
export class Dev extends Integration {
	constructor(init?: Partial<Dev>) {
		super()
		Object.assign(this, init)
	}

	override toString() {
		return `dev integration ${this.uri ?? this.id}`
	}

	override merge(incoming: Dev) {
		this.uri = incoming.uri || this.uri
	}

	override sync(): Promise<boolean> {
		return Promise.resolve(false)
	}

	protected override fetchSources(): Promise<Array<Source>> {
		return Promise.resolve([])
	}

	protected override syncSourceEntries(): Promise<boolean> {
		return Promise.resolve(false)
	}

	/** Dev sources have no external counterpart to re-import from — the local rows ARE the source,
	 * so a wipe-and-resync would just be deletion. */
	override resyncSource(): Promise<void> {
		return Promise.resolve()
	}

	override excludeOccurrence(_em: EntityManager, master: Entry, recurrenceId: Date): Promise<void> {
		// No .ics — record the excluded instant in the column the occurrence expansion filters on.
		master.exdates = [...(master.exdates ?? []), recurrenceId.getTime()]
		return Promise.resolve()
	}

	override createEntry(em: EntityManager, entry: Entry): Promise<Entry> {
		em.persist(entry)
		return Promise.resolve(entry)
	}

	override updateEntry(_em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		existing.heading = incoming.heading
		existing.description = incoming.description
		existing.location = incoming.location
		existing.color = incoming.color
		existing.start = incoming.start
		existing.end = incoming.end
		existing.allDay = incoming.allDay
		existing.timeZone = incoming.timeZone
		existing.status = incoming.status
		existing.reminders = incoming.reminders
		// Relations are deliberately NOT copied: Dev has no native link store, so the EntryRelation
		// table is the sole store and the route reconciles it (see Integration's relations contract).
		// Recurrence is column-only for Dev (no .ics); the GET path expands `recurrence` via
		// expandRecurrenceFields. (uid/recurrenceId aren't edited through the UI and Dev has no sync/overrides.)
		existing.recurrence = incoming.recurrence
		// Absent = keep: only a scoped series edit carries exclusions (shifted along with the series —
		// see occurrences.ts); a plain content edit stays silent about them.
		if (incoming.exdates !== undefined) {
			existing.exdates = incoming.exdates
		}
		return Promise.resolve()
	}

	override deleteEntry(em: EntityManager, entry: Entry): Promise<void> {
		em.remove(entry)
		return Promise.resolve()
	}
}

const INTEGRATION_ID = 'dev-sample-integration'
/** The sample's shape version, carried in the integration's uri: bumping it makes existing dev
 * databases wipe and re-seed the sample in the new shape (real integrations are never touched). */
const SAMPLE_URI = 'mitra://sample@3'

/**
 * Dev-only: seeds the persisted {@link Dev} sample integration with a few single-colour calendars —
 * Work, Personal, Holidays (events) and Tasks — whose entries set NO colour of their own, so they
 * inherit their calendar's colour. Idempotent and additive: seeds once (keyed by a stable id) and never
 * deletes, so re-running dev keeps any edits and the user can simply remove the integration when done.
 */
export async function seedDev(orm: MikroORM) {
	const em = orm.em.fork()

	// Detect the current sample by a raw read (don't hydrate — an earlier build used a different
	// integration `type`, whose discriminator this code no longer maps).
	const rows = await em.getConnection().execute('select type, uri from integration where id = ?', [INTEGRATION_ID]) as Array<{ type: string, uri: string }>
	const existing = rows[0]
	if (existing?.type === 'dev' && existing.uri === SAMPLE_URI) {
		return // up-to-date sample already present — keep it (and any edits made to it)
	}
	if (existing) {
		// A stale sample from an earlier build (a different `type`, or an older {@link SAMPLE_URI}
		// version): remove it and its children so it re-seeds in the current shape. Real integrations
		// are untouched. Children are deleted explicitly (sample ids are fixed) in case FK cascade
		// isn't enforced.
		await em.nativeDelete(Entry, { sourceId: { $like: 'dev-sample-%' } })
		await em.nativeDelete(Source, { integrationId: INTEGRATION_ID })
		await em.getConnection().execute('delete from integration where id = ?', [INTEGRATION_ID])
	}

	const user = await em.findOneOrFail(User, { username: User.default.username })
	const integration = new Dev({ id: INTEGRATION_ID, userId: user.id, uri: SAMPLE_URI })
	em.persist(integration)

	const calendar = (slug: string, type: SourceType, name: string, color: string) => {
		const source = new Source({ id: `dev-sample-${slug}`, integrationId: integration.id, uri: `mitra://sample/${slug}`, type, name, color, enabled: true, hidden: false })
		em.persist(source)
		return source
	}

	const work = calendar('work', SourceType.Event, 'Work', Color.Blue)
	const personal = calendar('personal', SourceType.Event, 'Personal', Color.Green)
	const holidays = calendar('holidays', SourceType.Event, 'Holidays', Color.Red)
	const tasks = calendar('tasks', SourceType.Task, 'Tasks', Color.Purple)

	const weekStart = new DateTime().weekStart.dayStart
	const at = (day: number, hour: number, minute = 0) => weekStart.add({ days: day }).with({ hour, minute })
	// All-day bounds are canonical UTC-midnight date encodings (see calendarDate.ts) — seed them so,
	// rather than as server-local midnights the boot backfill would only normalize on the NEXT start.
	const allDayStart = (day: number) => normalizeAllDay(weekStart.add({ days: day })) as unknown as DateTime

	// Entries carry no colour of their own — they inherit their calendar's colour. Every entry gets a
	// uid: relationships target uids (shared/Relation.ts), so a uid-less row couldn't be linked to.
	const on = (source: Source) => (init: Partial<Entry>) => {
		const entry = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), ...init, sourceId: source.id, type: source.type === SourceType.Task ? EntryType.Task : EntryType.Event })
		em.persist(entry)
		return entry
	}
	const event = on(work)
	const personalEvent = on(personal)
	const holiday = on(holidays)
	const task = on(tasks)

	// Work — Monday
	event({ heading: 'Standup', start: at(0, 9), end: at(0, 9, 15) })
	event({ heading: '1:1 with Sarah', start: at(0, 9, 30), end: at(0, 10) })
	event({ heading: 'Sprint Planning', start: at(0, 10), end: at(0, 11, 30) })
	event({ heading: 'Design Review', start: at(0, 14), end: at(0, 15) })
	// Work — Tuesday (Deep Work / Client Call overlap)
	event({ heading: 'Standup', start: at(1, 9), end: at(1, 9, 15) })
	event({ heading: 'Deep Work', start: at(1, 10), end: at(1, 12) })
	event({ heading: 'Client Call', start: at(1, 11), end: at(1, 11, 30) })
	// Work — Wednesday
	event({ heading: 'Standup', start: at(2, 9), end: at(2, 9, 15) })
	event({ heading: 'Architecture Sync', start: at(2, 11), end: at(2, 12) })
	event({ heading: 'Interview: Frontend', start: at(2, 15), end: at(2, 16) })
	// Work — Thursday (Standup overlaps Focus Block)
	event({ heading: 'Focus Block', start: at(3, 9), end: at(3, 12) })
	event({ heading: 'Standup', start: at(3, 9), end: at(3, 9, 15) })
	const productDemo = event({ heading: 'Product Demo', start: at(3, 14), end: at(3, 15) })
	// Work — Friday
	event({ heading: 'Standup', start: at(4, 9), end: at(4, 9, 15) })
	event({ heading: 'Sprint Retro', start: at(4, 15), end: at(4, 16) })

	// Personal
	personalEvent({ heading: 'Gym', start: at(1, 18), end: at(1, 19) })
	personalEvent({ heading: 'Lunch w/ Alex', start: at(2, 12, 30), end: at(2, 13, 30) })
	personalEvent({ heading: 'Happy Hour', start: at(4, 17), end: at(4, 18, 30) })

	// A multi-day *timed* event (Tue afternoon → Thu morning): the timed grid shows a run spanning
	// columns, clamped at the day edges.
	event({ heading: 'Offsite', start: at(1, 13), end: at(3, 11) })

	// Overlapping all-day events, so the all-day lane shows several stacked lanes:
	event({ heading: 'Conference', start: allDayStart(1), end: allDayStart(4), allDay: true })          // Tue–Thu
	personalEvent({ heading: 'Family Visit', start: allDayStart(2), end: allDayStart(5), allDay: true }) // Wed–Fri (overlaps Conference)
	holiday({ heading: 'Public Holiday', start: allDayStart(4), end: allDayStart(5), allDay: true })     // Fri (overlaps Family Visit)
	personalEvent({ heading: 'Berlin Trip', start: allDayStart(5), end: allDayStart(10), allDay: true }) // Sat → next week

	// Tasks, mid-day — one per status so the checkbox/menu states are all visible in dev.
	task({ heading: 'Submit expense report', status: TaskStatus.Done, start: at(0, 11), end: at(0, 11, 30) })
	const reviewPr = task({ heading: 'Review PR #312', status: TaskStatus.Doing, start: at(1, 13), end: at(1, 13, 30) })
	task({ heading: 'Update roadmap doc', status: TaskStatus.ToDo, start: at(2, 14), end: at(2, 14, 30) })
	const demoSlides = task({ heading: 'Prepare demo slides', status: TaskStatus.Cancelled, start: at(3, 12), end: at(3, 13) })
	const weeklyUpdate = task({ heading: 'Send weekly update', status: TaskStatus.Done, start: at(4, 11, 30), end: at(4, 12) })

	// Relationships showcase — the EntryRelation table IS Dev's native store, so seed rows directly:
	// a task that's a subtask of an EVENT (mixed task↔event links are first-class), and a task that
	// waits for another ("Send weekly update" after "Review PR #312").
	const relate = (entry: Entry, type: string, target: Entry) => em.persist(new EntryRelation({ entryId: entry.id!, type, targetUid: target.uid! }))
	relate(demoSlides, RelationType.Parent, productDemo)
	relate(weeklyUpdate, RelationType.FinishToStart, reviewPr)

	// — The rest of the year, so the year view has a story to tell: multi-day/multi-week arcs, quarterly
	// milestones, seasonal holidays and a couple of yearly-recurring days, anchored to the current year.
	// All-day ends are exclusive next midnight, so `end: date(m, d)` means "through the day before d".
	const yearStart = new DateTime().yearStart.dayStart
	const date = (month: number, day: number) => yearStart.with({ month, day })

	// Personal arcs
	personalEvent({ heading: 'Ski Trip', start: date(2, 8), end: date(2, 16), allDay: true })
	personalEvent({ heading: 'Family Reunion', start: date(5, 23), end: date(5, 26), allDay: true })
	personalEvent({ heading: 'Summer Vacation, Italy', start: date(8, 3), end: date(8, 18), allDay: true, location: 'Tuscany' })
	personalEvent({ heading: 'House Renovation', start: date(9, 14), end: date(10, 25), allDay: true })
	personalEvent({ heading: 'City Marathon', start: date(10, 11).with({ hour: 9 }), end: date(10, 11).with({ hour: 14 }) })
	personalEvent({ heading: 'Mom’s Birthday', start: date(3, 11), end: date(3, 12), allDay: true, recurrence: new Recurrence({ freq: 'YEARLY' }) })
	personalEvent({ heading: 'Anniversary', start: date(6, 21), end: date(6, 22), allDay: true, recurrence: new Recurrence({ freq: 'YEARLY' }) })

	// Work milestones & phases
	event({ heading: 'Q1 Planning', start: date(1, 8), end: date(1, 11), allDay: true })
	event({ heading: 'Q2 Planning', start: date(4, 7), end: date(4, 10), allDay: true })
	event({ heading: 'Q3 Planning', start: date(7, 7), end: date(7, 10), allDay: true })
	event({ heading: 'Q4 Planning', start: date(10, 6), end: date(10, 9), allDay: true })
	event({ heading: 'Team Offsite', start: date(5, 12), end: date(5, 15), allDay: true })
	event({ heading: 'Annual Conference', start: date(9, 22), end: date(9, 26), allDay: true, location: 'Convention Center' })
	event({ heading: 'Code Freeze', start: date(11, 10), end: date(11, 18), allDay: true })
	event({ heading: 'v2.0 Launch', start: date(11, 18), end: date(11, 19), allDay: true })
	event({ heading: 'Performance Reviews', start: date(12, 1), end: date(12, 6), allDay: true })

	// Holidays through the year
	holiday({ heading: 'New Year’s Day', start: date(1, 1), end: date(1, 2), allDay: true })
	holiday({ heading: 'Spring Holiday', start: date(4, 18), end: date(4, 22), allDay: true })
	holiday({ heading: 'National Day', start: date(10, 3), end: date(10, 4), allDay: true })
	holiday({ heading: 'Christmas', start: date(12, 24), end: date(12, 27), allDay: true })
	holiday({ heading: 'New Year’s Eve', start: date(12, 31), end: date(12, 31).add({ days: 1 }), allDay: true })

	// Year-scale tasks
	task({ heading: 'File tax return', status: TaskStatus.ToDo, start: date(4, 10), end: date(4, 11), allDay: true })
	task({ heading: 'Book vacation flights', status: TaskStatus.Done, start: date(5, 5), end: date(5, 6), allDay: true })
	task({ heading: 'Renew passport', status: TaskStatus.ToDo, start: date(8, 25), end: date(8, 26), allDay: true })

	await em.flush()
}
