import { type EntityManager, type MikroORM } from '@mikro-orm/sqlite'
import { DateTime } from '@3mo/date-time'
import { model, entity, Integration, Source, SourceType, Entry, EntryType, TaskStatus, User, Color } from '../shared/index.js'

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
		// Recurrence is column-only for Dev (no .ics); the GET path expands `recurrence` via
		// expandRecurrenceFields. (uid/recurrenceId aren't edited through the UI and Dev has no sync/overrides.)
		existing.recurrence = incoming.recurrence
		return Promise.resolve()
	}

	override deleteEntry(em: EntityManager, entry: Entry): Promise<void> {
		em.remove(entry)
		return Promise.resolve()
	}
}

const INTEGRATION_ID = 'dev-sample-integration'

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
	const rows = await em.getConnection().execute('select type from integration where id = ?', [INTEGRATION_ID]) as Array<{ type: string }>
	const existingType = rows[0]?.type
	if (existingType === 'dev') {
		return // up-to-date sample already present — keep it (and any edits made to it)
	}
	if (existingType) {
		// A stale sample from an earlier build (before the all-day flag / the Local→Dev rename): remove it
		// and its children so it re-seeds in the current shape. Real integrations are untouched. Children
		// are deleted explicitly (sample ids are fixed) in case FK cascade isn't enforced.
		await em.nativeDelete(Entry, { sourceId: { $like: 'dev-sample-%' } })
		await em.nativeDelete(Source, { integrationId: INTEGRATION_ID })
		await em.getConnection().execute('delete from integration where id = ?', [INTEGRATION_ID])
	}

	const user = await em.findOneOrFail(User, { username: User.default.username })
	const integration = new Dev({ id: INTEGRATION_ID, userId: user.id, uri: 'mitra://sample' })
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
	const allDayStart = (day: number) => weekStart.add({ days: day }) // midnight → genuinely all-day

	// Entries carry no colour of their own — they inherit their calendar's colour.
	const on = (source: Source) => (init: Partial<Entry>) => {
		const entry = new Entry({ id: crypto.randomUUID(), ...init, sourceId: source.id, type: source.type === SourceType.Task ? EntryType.Task : EntryType.Event })
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
	event({ heading: 'Product Demo', start: at(3, 14), end: at(3, 15) })
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
	task({ heading: 'Review PR #312', status: TaskStatus.Doing, start: at(1, 13), end: at(1, 13, 30) })
	task({ heading: 'Update roadmap doc', status: TaskStatus.ToDo, start: at(2, 14), end: at(2, 14, 30) })
	task({ heading: 'Prepare demo slides', status: TaskStatus.Cancelled, start: at(3, 12), end: at(3, 13) })
	task({ heading: 'Send weekly update', status: TaskStatus.Done, start: at(4, 11, 30), end: at(4, 12) })

	await em.flush()
}
