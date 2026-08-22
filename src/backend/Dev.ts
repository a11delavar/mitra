import { type EntityManager, type MikroORM } from '@mikro-orm/sqlite'
import { DateTime } from '@3mo/date-time'
import { model, entity, Integration, Source, Entry, EntryType, TaskStatus, User, Color, normalizeAllDay, Recurrence, ParticipantRole, ParticipantStatus, EntryRelation, RelationType } from '../shared/index.js'

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

	/** Local-only: the rows in our database ARE the data, so there is no remote to poll — the
	 * background daemon and manual refreshes skip this integration entirely. */
	override get syncInterval() { return Infinity }

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
	 * so a wipe-and-rebuild would just be deletion. */
	override reimportSource(): Promise<void> {
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
		existing.percentComplete = incoming.percentComplete
		existing.transparency = incoming.transparency
		existing.visibility = incoming.visibility
		existing.reminders = incoming.reminders
		existing.participants = incoming.participants
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

/**
 * Dev-only: seeds the persisted {@link Dev} sample integration with realistic events.
 * It uses the current date in the URI to ensure the fixture is recreated once a day, staying
 * anchored to the current date while preserving edits made during a single day's dev session.
 */
export async function seedDev(orm: MikroORM) {
	const em = orm.em.fork()

	const today = new DateTime()
	const todayStr = `${today.year}-${today.month}-${today.day}`
	const SAMPLE_URI = `mitra://sample/realistic@${todayStr}`

	// Realistic fixture check
	const rows = await em.getConnection().execute('select type, uri from integration where id = ?', [INTEGRATION_ID]) as Array<{ type: string, uri: string }>
	const existing = rows[0]

	const user = await em.findOneOrFail(User, { username: User.default.username })
	const me = 'me@example.com'

	if (existing?.type !== 'dev' || existing.uri !== SAMPLE_URI) {
		if (existing) {
			await em.nativeDelete(Entry, { sourceId: { $like: 'dev-sample-%' } })
			await em.nativeDelete(Source, { integrationId: INTEGRATION_ID })
			await em.getConnection().execute('delete from integration where id = ?', [INTEGRATION_ID])
		}

		// Clean up any other dev integrations if they exist
		for (const otherId of ['dev-realistic-integration', 'dev-edge-cases-integration']) {
			const otherRows = await em.getConnection().execute('select id from integration where id = ?', [otherId])
			if (otherRows.length > 0) {
				await em.nativeDelete(Entry, { sourceId: { $like: `${otherId.replace('-integration', '')}-%` } })
				await em.nativeDelete(Source, { integrationId: otherId })
				await em.getConnection().execute('delete from integration where id = ?', [otherId])
			}
		}

		const integration = new Dev({
			id: INTEGRATION_ID,
			userId: user.id,
			uri: SAMPLE_URI,
			addresses: [me],
			credentials: { username: me }
		})
		em.persist(integration)

		const calendar = (slug: string, types: Array<EntryType>, name: string, color: string) => {
			const source = new Source({ id: `dev-sample-${slug}`, integrationId: integration.id, uri: `mitra://sample/${slug}`, entryTypes: types, name, color, enabled: true, hidden: false })
			em.persist(source)
			return source
		}

		const personal = calendar('personal', [EntryType.Event, EntryType.Task], 'Personal', Color.Green)
		const hobbies = calendar('hobbies', [EntryType.Event, EntryType.Task], 'Hobbies', Color.Purple)
		const university = calendar('university', [EntryType.Event, EntryType.Task], 'University', Color.Yellow)
		const work = calendar('work', [EntryType.Event, EntryType.Task], 'Work', Color.Blue)
		const upkeep = calendar('upkeep', [EntryType.Event, EntryType.Task], 'Upkeep', Color.Grey)

		const todayStart = today.dayStart
		const thisWeekMonday = todayStart.weekStart.dayStart
		const nextWeekMonday = thisWeekMonday.add({ days: 7 })
		const lastWeekMonday = thisWeekMonday.subtract({ days: 7 })
		const pastStart = todayStart.subtract({ years: 2 }).weekStart.dayStart // 2 years ago base

		const at = (base: DateTime, dayOffset: number, hour: number, minute = 0) => base.add({ days: dayOffset }).with({ hour, minute })
		const allDayStart = (base: DateTime, dayOffset: number) => normalizeAllDay(base.add({ days: dayOffset })) as unknown as DateTime

		const on = (source: Source) => (init: Partial<Entry>) => {
			const entry = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), type: source.defaultEntryType, ...init, sourceId: source.id })
			em.persist(entry)
			return entry
		}

		const workEvent = on(work)
		const workTask = (init: Partial<Entry>) => on(work)({ type: EntryType.Task, ...init })
		const personalEvent = on(personal)
		const hobbyEvent = on(hobbies)
		const upkeepTask = (init: Partial<Entry>) => on(upkeep)({ type: EntryType.Task, ...init })
		const upkeepEvent = on(upkeep)
		const uniEvent = on(university)
		// @ts-ignore - used in commented out subtasks
		const uniTask = (init: Partial<Entry>) => on(university)({ type: EntryType.Task, ...init })

		const relate = (entry: Entry, type: RelationType, target: Entry) => em.persist(new EntryRelation({ entryId: entry.id!, type, targetUid: target.uid! }))

		// ---- Work (Blue) ----

		const examWeek1Exdate = at(nextWeekMonday, 0, 14).getTime()
		const examWeek2Exdate = at(nextWeekMonday, 7, 14).getTime()

		workEvent({
			heading: 'Weekly Team Sync',
			start: at(pastStart, 0, 14), // Starting 2 years ago
			end: at(pastStart, 0, 15),
			recurrence: new Recurrence({ freq: 'WEEKLY' }),
			exdates: [examWeek1Exdate, examWeek2Exdate],
			participants: [
				{ email: me, organizer: true, self: true, role: ParticipantRole.Required, status: ParticipantStatus.Accepted },
				{ email: 'colleague1@company.com', role: ParticipantRole.Required, status: ParticipantStatus.Accepted },
				{ email: 'colleague2@company.com', role: ParticipantRole.Required, status: ParticipantStatus.Tentative },
			],
		})

		const q3Planning = workEvent({
			heading: 'Q3 Planning Strategy',
			start: at(thisWeekMonday, 21, 10), // Monday after exam phase
			end: at(thisWeekMonday, 21, 16)
		})

		const prepQ3 = workTask({
			heading: 'Prepare Q3 Presentation',
			status: TaskStatus.Doing,
			start: at(thisWeekMonday, 4, 10), // This Friday
			end: at(thisWeekMonday, 4, 14)
		})
		relate(q3Planning, RelationType.FinishToStart, prepQ3)

		// DB Migration Project (Mon, Wed, Fri of last week)
		const writeMigScript = workTask({ heading: 'Write Migration Script', status: TaskStatus.Done, start: at(lastWeekMonday, 0, 9), end: at(lastWeekMonday, 0, 15) })
		const testMig = workTask({ heading: 'Test Database Migration', status: TaskStatus.Done, start: at(lastWeekMonday, 2, 9), end: at(lastWeekMonday, 2, 14) })
		const execMig = workEvent({ heading: 'Execute Database Migration', start: at(lastWeekMonday, 4, 9), end: at(lastWeekMonday, 4, 11) })
		relate(testMig, RelationType.FinishToStart, writeMigScript)
		relate(execMig, RelationType.FinishToStart, testMig)

		// Project parent with 2 of 3 subtasks done to exercise the progress rollup ring and last-child prompt.
		const migrationProject = workTask({
			heading: 'Database Migration',
			status: TaskStatus.Doing,
			start: at(lastWeekMonday, 0, 0),
			end: at(lastWeekMonday, 7, 12),
			allDay: true,
		})
		const migrationSignOff = workTask({ heading: 'Sign Off Migration Rollback Plan', status: TaskStatus.ToDo, start: at(thisWeekMonday, -2, 11), end: at(thisWeekMonday, -2, 12) })
		relate(writeMigScript, RelationType.Parent, migrationProject)
		relate(testMig, RelationType.Parent, migrationProject)
		relate(migrationSignOff, RelationType.Parent, migrationProject)

		// Long tasks (Mon, Wed, Fri only)
		workTask({ heading: 'Draft New System Architecture', status: TaskStatus.ToDo, start: at(thisWeekMonday, 0, 9), end: at(thisWeekMonday, 0, 15) }) // Mon
		workTask({ heading: 'Finalize Budget Report', status: TaskStatus.ToDo, start: at(thisWeekMonday, 2, 10), end: at(thisWeekMonday, 2, 14) }) // Wed

		workTask({
			heading: 'Submit Expense Report',
			start: at(pastStart, 4, 16),
			end: at(pastStart, 4, 16, 30),
			status: TaskStatus.ToDo,
			recurrence: new Recurrence({ freq: 'MONTHLY', bymonthday: 1 })
		})

		// ---- Personal (Green) ----

		personalEvent({
			heading: 'Dentist Appointment',
			start: at(nextWeekMonday, 2, 16),
			end: at(nextWeekMonday, 2, 17)
		})

		personalEvent({
			heading: 'Dinner with friends',
			start: at(nextWeekMonday, 4, 19),
			end: at(nextWeekMonday, 4, 22),
			location: 'City Center'
		})

		// ---- Upkeep (Grey) ----

		const hikeGroceryExdate = at(thisWeekMonday, 5, 10).getTime() // Exclude the Saturday of the hike

		upkeepTask({
			heading: '🛒 Grocery Shopping',
			start: at(pastStart, 5, 10),
			end: at(pastStart, 5, 11),
			status: TaskStatus.ToDo,
			recurrence: new Recurrence({ freq: 'WEEKLY' }),
			exdates: [hikeGroceryExdate]
		})

		// Rescheduled Grocery Shopping for the hike week
		upkeepTask({
			heading: '🛒 Grocery Shopping',
			start: at(thisWeekMonday, 5, 16), // Saturday afternoon after the hike
			end: at(thisWeekMonday, 5, 17),
			status: TaskStatus.ToDo
		})

		upkeepTask({
			heading: 'Deep Clean Apartment',
			start: at(pastStart, 5, 20),
			end: at(pastStart, 5, 22),
			status: TaskStatus.ToDo,
			recurrence: new Recurrence({ freq: 'MONTHLY', bymonthday: 1 })
		})

		upkeepEvent({
			heading: 'Car Inspection',
			start: at(pastStart, 1, 9),
			end: at(pastStart, 1, 10),
			recurrence: new Recurrence({ freq: 'YEARLY' })
		})

		upkeepTask({
			heading: 'Water Plants',
			start: at(pastStart, 2, 18),
			end: at(pastStart, 2, 18, 15),
			status: TaskStatus.ToDo,
			recurrence: new Recurrence({ freq: 'WEEKLY' })
		})

		// ---- Hobbies (Purple) ----

		hobbyEvent({
			heading: '🏐 Volleyball Practice',
			start: at(pastStart, 1, 18, 30),
			end: at(pastStart, 1, 20),
			recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['TU', 'TH'] })
		})

		hobbyEvent({
			heading: '💪 Gym',
			start: at(pastStart, 0, 7, 0),
			end: at(pastStart, 0, 8, 0),
			recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'WE'] })
		})

		hobbyEvent({
			heading: 'Weekend Hike in the Mountains',
			start: at(thisWeekMonday, 5, 8),
			end: at(thisWeekMonday, 5, 15),
			location: 'Mountains'
		})

		const month1Start = todayStart.add({ months: 1 }).weekStart.dayStart
		hobbyEvent({
			heading: 'Summer Vacation',
			start: allDayStart(month1Start, 0),
			end: allDayStart(month1Start, 14),
			allDay: true,
			location: 'Beach Resort'
		})

		personalEvent({
			heading: '✈️ Flight to Beach Resort',
			start: at(month1Start, 0, 10),
			end: at(month1Start, 0, 13),
			location: 'Airport'
		})

		personalEvent({
			heading: '✈️ Flight back home',
			start: at(month1Start, 13, 14),
			end: at(month1Start, 13, 17),
			location: 'Airport'
		})

		const month2Start = todayStart.add({ months: 2 }).weekStart.dayStart
		hobbyEvent({
			heading: 'Photography Workshop',
			start: allDayStart(month2Start, 5),
			end: allDayStart(month2Start, 7),
			allDay: true
		})

		// ---- University (Yellow) ----

		// Exam Phase: Yearly recurring (matches this year's nextWeekMonday)
		const pastNextWeek = nextWeekMonday.subtract({ years: 2 })
		uniEvent({
			heading: 'Exam Phase',
			start: allDayStart(pastNextWeek, 0),
			end: allDayStart(pastNextWeek, 14),
			allDay: true,
			recurrence: new Recurrence({ freq: 'YEARLY' })
		})

		const algoExam = uniEvent({
			heading: 'Exam: Data Structures & Algorithms',
			start: at(nextWeekMonday, 3, 10), // Thursday next week
			end: at(nextWeekMonday, 3, 12)
		})

		const algoPrep1 = uniTask({ heading: 'DA: Study Graphs and Trees', status: TaskStatus.Done, start: at(nextWeekMonday, 0, 10), end: at(nextWeekMonday, 0, 14) })
		const algoPrep2 = uniTask({ heading: 'DA: Study Dynamic Programming', status: TaskStatus.Doing, start: at(nextWeekMonday, 1, 10), end: at(nextWeekMonday, 1, 14) })
		const algoPrep3 = uniTask({ heading: 'DA: Solve Practice Exam', status: TaskStatus.ToDo, start: at(nextWeekMonday, 2, 10), end: at(nextWeekMonday, 2, 14) })

		// Dependencies for Algo
		relate(algoPrep3, RelationType.FinishToStart, algoPrep1)
		relate(algoPrep3, RelationType.FinishToStart, algoPrep2)
		relate(algoExam, RelationType.FinishToStart, algoPrep3)

		const mlExam = uniEvent({
			heading: 'Exam: Machine Learning',
			start: at(nextWeekMonday, 8, 14), // Next next Tuesday
			end: at(nextWeekMonday, 8, 16)
		})

		const mlPrep1 = uniTask({ heading: 'ML: Review Linear Algebra', status: TaskStatus.ToDo, start: at(nextWeekMonday, 4, 10), end: at(nextWeekMonday, 4, 14) })
		const mlPrep2 = uniTask({ heading: 'ML: Study Neural Networks', status: TaskStatus.ToDo, start: at(nextWeekMonday, 6, 10), end: at(nextWeekMonday, 6, 14) })
		const mlPrep3 = uniTask({ heading: 'ML: Implement Backpropagation', status: TaskStatus.ToDo, start: at(nextWeekMonday, 7, 10), end: at(nextWeekMonday, 7, 14) })

		// Dependencies for ML
		relate(mlPrep2, RelationType.FinishToStart, mlPrep1)
		relate(mlPrep3, RelationType.FinishToStart, mlPrep2)
		relate(mlExam, RelationType.FinishToStart, mlPrep3)

		// Exam Period: 6 months from now
		const month6Start = todayStart.add({ months: 6 }).weekStart.dayStart

		const pastMonth6Start = month6Start.subtract({ years: 2 })
		uniEvent({
			heading: 'Exam Phase',
			start: allDayStart(pastMonth6Start, 0),
			end: allDayStart(pastMonth6Start, 14),
			allDay: true,
			recurrence: new Recurrence({ freq: 'YEARLY' })
		})

		const advCalcExam = uniEvent({
			heading: 'Exam: Advanced Calculus',
			start: at(month6Start, 2, 9),
			end: at(month6Start, 2, 12)
		})

		const calcPrep1 = uniTask({ heading: 'AC: Review Integrals', status: TaskStatus.ToDo, start: at(month6Start, 0, 10), end: at(month6Start, 0, 14) })
		const calcPrep2 = uniTask({ heading: 'AC: Study Multivariable Calculus', status: TaskStatus.ToDo, start: at(month6Start, 1, 10), end: at(month6Start, 1, 14) })
		relate(calcPrep2, RelationType.FinishToStart, calcPrep1)
		relate(advCalcExam, RelationType.FinishToStart, calcPrep2)

		// ---- Unscheduled (no dates at all) ----
		// Across calendars and statuses, so the section renders with more than one colour and mark.
		workTask({ heading: 'Draft the hiring plan' })
		workTask({ heading: 'Reply to the vendor quote', status: TaskStatus.Doing })
		personalEvent({ type: EntryType.Task, heading: 'Renew the passport' })
		upkeepTask({ heading: 'Descale the coffee machine' })
		upkeepTask({ heading: 'Replace the bathroom bulb', status: TaskStatus.Done })
		uniTask({ heading: 'Pick a thesis topic' })
	}

	await em.flush()
}
