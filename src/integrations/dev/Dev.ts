import { type EntityManager, type MikroORM } from '@mikro-orm/sqlite'
import { DateTime } from '@3mo/date-time'
import { User } from '../../features/identity/User.js'
import { Source } from '../../features/sources/Source.js'
import { RelationType } from '../../features/relations/RelationType.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { ParticipantRole, ParticipantStatus } from '../../features/participants/Participant.js'
import { model } from '../../infrastructure/model/model.js'
import { Integration } from '../Integration.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { Entry, TaskStatus } from '../../features/entries/Entry.js'
import { Color } from '../../features/sources/Color.js'
import { normalizeAllDay } from '../../features/time/calendarDate.js'
import { entity } from '../../infrastructure/model/orm.js'

/** Dev-only local calendar integration with no external backend. */
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

	override reimportSource(): Promise<void> {
		return Promise.resolve()
	}

	override excludeOccurrence(_em: EntityManager, master: Entry, recurrenceId: Date): Promise<void> {
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
		existing.recurrence = incoming.recurrence
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

/** Changes daily, so the dev account's copy is rebuilt around today instead of ageing in place. */
export function sampleUri() {
	const today = new DateTime()
	return `mitra://sample/realistic@${today.year}-${today.month}-${today.day}`
}

/** Seeds the sample calendar for one user with fresh ids. Read AGENTS.md §The Sample Calendar first. */
export async function seedSample(em: EntityManager, user: User) {
	const today = new DateTime()
	const me = 'me@example.com'

	const integration = new Dev({
		userId: user.id,
		uri: sampleUri(),
		addresses: [me],
		credentials: { username: me }
	})
	em.persist(integration)

	const calendar = (slug: string, types: Array<EntryType>, name: string, color: string) => {
		const source = new Source({ integrationId: integration.id, uri: `mitra://sample/${slug}`, entryTypes: types, name, color, enabled: true, hidden: false, importedAt: new Date() })
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
	const personalTask = (init: Partial<Entry>) => on(personal)({ type: EntryType.Task, ...init })
	const hobbyEvent = on(hobbies)
	const upkeepTask = (init: Partial<Entry>) => on(upkeep)({ type: EntryType.Task, ...init })
	const upkeepEvent = on(upkeep)
	const uniEvent = on(university)
	const uniTask = (init: Partial<Entry>) => on(university)({ type: EntryType.Task, ...init })

	const relate = (entry: Entry, type: RelationType, target: Entry) => em.persist(new EntryRelation({ entryId: entry.id!, type, targetUid: target.uid! }))

	// ---- Rhythm: one entry per habit, no more ---------------------------------------------------

	hobbyEvent({
		heading: '💪 Gym',
		start: at(pastStart, 0, 8),
		end: at(pastStart, 0, 9),
		recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['MO', 'WE', 'FR'] })
	})

	// Five minutes draws as a hairline — a daily mark for the year view without a bar in the week.
	personalEvent({
		heading: '💊 Morning Meds',
		start: at(pastStart, 0, 7, 30),
		end: at(pastStart, 0, 7, 35),
		recurrence: new Recurrence({ freq: 'DAILY' })
	})

	hobbyEvent({
		heading: '🏐 Volleyball',
		start: at(pastStart, 3, 18),
		end: at(pastStart, 3, 19, 30),
		recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['TH'] })
	})

	personalEvent({
		heading: 'Therapy',
		start: at(pastStart, 2, 18),
		end: at(pastStart, 2, 19),
		recurrence: new Recurrence({ freq: 'WEEKLY', interval: 2, byday: ['WE'] })
	})

	// ---- Work (Blue) -------------------------------------------------------------------------

	workEvent({
		heading: 'Weekly Team Sync',
		start: at(pastStart, 1, 12), // Tuesdays, starting 2 years ago
		end: at(pastStart, 1, 13),
		recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['TU'] }),
		participants: [
			{ email: me, organizer: true, self: true, role: ParticipantRole.Required, status: ParticipantStatus.Accepted },
			{ email: 'colleague1@company.com', role: ParticipantRole.Required, status: ParticipantStatus.Accepted },
			{ email: 'colleague2@company.com', role: ParticipantRole.Required, status: ParticipantStatus.Tentative },
		],
	})

	workTask({
		heading: 'Submit Expense Report',
		start: at(pastStart, 4, 16),
		end: at(pastStart, 4, 16, 30),
		status: TaskStatus.ToDo,
		recurrence: new Recurrence({ freq: 'MONTHLY', bymonthday: 1 })
	})

	workTask({ heading: 'Draft New System Architecture', status: TaskStatus.ToDo, start: at(thisWeekMonday, 0, 9), end: at(thisWeekMonday, 0, 12) })
	workEvent({ heading: 'Team Retro', start: at(nextWeekMonday, 2, 15), end: at(nextWeekMonday, 2, 16) })

	const q3Planning = workEvent({
		heading: 'Q3 Planning Strategy',
		start: at(nextWeekMonday, 0, 10),
		end: at(nextWeekMonday, 0, 16)
	})

	const prepQ3 = workTask({
		heading: 'Prepare Q3 Presentation',
		status: TaskStatus.Doing,
		start: at(thisWeekMonday, 4, 13),
		end: at(thisWeekMonday, 4, 17)
	})
	relate(q3Planning, RelationType.FinishToStart, prepQ3)

	// ---- Personal (Green) --------------------------------------------------------------------

	personalEvent({
		heading: 'Dentist Appointment',
		start: at(thisWeekMonday, 3, 14),
		end: at(thisWeekMonday, 3, 15)
	})

	personalEvent({
		heading: 'Dinner with friends',
		start: at(nextWeekMonday, 4, 19),
		end: at(nextWeekMonday, 4, 22),
		location: 'City Center'
	})

	const declutter = personalTask({
		heading: 'Declutter the Flat',
		status: TaskStatus.Doing,
		start: at(thisWeekMonday, 6, 12),
		end: at(thisWeekMonday, 6, 14),
		description: [
			'Room by room, **one box at a time**:',
			'',
			'- [x] Laundry',
			'- [ ] Wardrobe',
			'- [ ] Cables and electronics drawer',
		].join('\n'),
	})
	const charityPickup = personalTask({
		heading: 'Book the Charity Pickup',
		status: TaskStatus.Done,
		start: at(thisWeekMonday, 4, 11),
		end: at(thisWeekMonday, 4, 11, 30),
	})
	relate(charityPickup, RelationType.Parent, declutter)

	// ---- Upkeep (Grey) -----------------------------------------------------------------------

	const hikeGroceryExdate = at(thisWeekMonday, 5, 10).getTime() // Excluded: the Saturday of the hike

	upkeepTask({
		heading: '🛒 Grocery Shopping',
		start: at(pastStart, 5, 10),
		end: at(pastStart, 5, 11),
		status: TaskStatus.ToDo,
		recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['SA'] }),
		exdates: [hikeGroceryExdate]
	})

	// The occurrence the hike displaced, moved rather than skipped.
	upkeepTask({
		heading: '🛒 Grocery Shopping',
		start: at(thisWeekMonday, 5, 17),
		end: at(thisWeekMonday, 5, 18),
		status: TaskStatus.ToDo
	})

	// Evening: a monthly entry lands on whatever weekday its date falls on.
	upkeepTask({
		heading: 'Deep Clean Apartment',
		start: at(pastStart, 5, 17),
		end: at(pastStart, 5, 19),
		status: TaskStatus.ToDo,
		recurrence: new Recurrence({ freq: 'MONTHLY', bymonthday: 15 })
	})

	upkeepEvent({
		heading: 'Car Inspection',
		start: at(pastStart, 1, 9),
		end: at(pastStart, 1, 10),
		recurrence: new Recurrence({ freq: 'YEARLY' })
	})

	// ---- Hobbies (Purple) --------------------------------------------------------------------

	hobbyEvent({
		heading: 'Weekend Hike in the Mountains',
		start: at(thisWeekMonday, 5, 9),
		end: at(thisWeekMonday, 5, 16),
		location: 'Mountains'
	})

	// All-day entries stay a month or more out; a band across every column crowds the near week.
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

	// ---- University (Yellow) -----------------------------------------------------------------

	// The one chain near today. It must stay in the CURRENT week — the app opens on today−2…today+4.
	const algoExam = uniEvent({
		heading: 'Exam: Data Structures & Algorithms',
		start: at(thisWeekMonday, 3, 9),
		end: at(thisWeekMonday, 3, 11)
	})

	const algoPrep1 = uniTask({ heading: 'DA: Study Graphs and Trees', status: TaskStatus.Done, start: at(thisWeekMonday, 0, 13), end: at(thisWeekMonday, 0, 17) })
	const algoPrep2 = uniTask({ heading: 'DA: Study Dynamic Programming', status: TaskStatus.Doing, start: at(thisWeekMonday, 1, 8), end: at(thisWeekMonday, 1, 11) })
	const algoPrep3 = uniTask({ heading: 'DA: Solve Practice Exam', status: TaskStatus.ToDo, start: at(thisWeekMonday, 2, 12), end: at(thisWeekMonday, 2, 15) })

	// Staggered, with a clear band between: a connector is swallowed by any chip in its way.
	relate(algoPrep3, RelationType.FinishToStart, algoPrep1)
	relate(algoPrep3, RelationType.FinishToStart, algoPrep2)
	relate(algoExam, RelationType.FinishToStart, algoPrep3)

	const month6Start = todayStart.add({ months: 6 }).weekStart.dayStart
	const pastMonth6Start = month6Start.subtract({ years: 2 })

	uniEvent({
		heading: 'Exam Phase',
		start: allDayStart(pastMonth6Start, 0),
		end: allDayStart(pastMonth6Start, 12),
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

	// ---- History -----------------------------------------------------------------------------

	const past = (weeks: number, dayOffset: number, hour: number, minute = 0) => at(thisWeekMonday.subtract({ days: weeks * 7 }), dayOffset, hour, minute)

	// Two weeks back, not one: the parent's all-day band would otherwise sit in the opening window.
	const writeMigScript = workTask({ heading: 'Write Migration Script', status: TaskStatus.Done, start: past(2, 0, 9), end: past(2, 0, 15) })
	const testMig = workTask({ heading: 'Test Database Migration', status: TaskStatus.Done, start: past(2, 2, 9), end: past(2, 2, 14) })
	const execMig = workEvent({ heading: 'Execute Database Migration', start: past(2, 4, 9), end: past(2, 4, 11) })
	relate(testMig, RelationType.FinishToStart, writeMigScript)
	relate(execMig, RelationType.FinishToStart, testMig)

	const migrationProject = workTask({
		heading: 'Database Migration',
		status: TaskStatus.Doing,
		start: past(2, 0, 0),
		end: past(2, 7, 12),
		allDay: true,
	})
	const migrationSignOff = workTask({ heading: 'Sign Off Migration Rollback Plan', status: TaskStatus.ToDo, start: past(1, 4, 11), end: past(1, 4, 12) })
	relate(writeMigScript, RelationType.Parent, migrationProject)
	relate(testMig, RelationType.Parent, migrationProject)
	relate(migrationSignOff, RelationType.Parent, migrationProject)

	workTask({ heading: 'Close the Q2 books', status: TaskStatus.Done, start: past(1, 1, 9), end: past(1, 1, 12) })
	workTask({ heading: 'Review the security audit', status: TaskStatus.Done, start: past(3, 3, 14), end: past(3, 3, 16) })
	workTask({ heading: 'Rewrite the onboarding doc', status: TaskStatus.Done, start: past(4, 0, 10), end: past(4, 0, 15) })
	uniTask({ heading: 'DA: Read chapters 1-4', status: TaskStatus.Done, start: past(3, 1, 18), end: past(3, 1, 21) })
	upkeepTask({ heading: 'Service the bike', status: TaskStatus.Done, start: past(5, 5, 11), end: past(5, 5, 13) })
	personalTask({ heading: 'Return the parcel', status: TaskStatus.Cancelled, start: past(4, 4, 16), end: past(4, 4, 17) })

	// Overdue beyond the fetch window, where the planning list is the only surface that reaches it.
	upkeepTask({ heading: 'Renew the tenancy insurance', start: past(40, 1, 10), end: past(40, 1, 11) })

	// ---- Unscheduled -------------------------------------------------------------------------

	workTask({ heading: 'Draft the hiring plan' })
	workTask({ heading: 'Reply to the vendor quote', status: TaskStatus.Doing })
	personalTask({ heading: 'Renew the passport' })
	uniTask({ heading: 'Pick a thesis topic' })
	await em.flush()
}

/** Refreshes the dev account's sample calendar, at most once a day. */
export async function seedDev(orm: MikroORM) {
	const em = orm.em.fork()
	const user = await em.findOneOrFail(User, { username: User.default.username })
	const existing = await em.find(Dev, { userId: user.id })
	if (existing.length === 1 && existing[0]!.uri === sampleUri()) {
		return
	}
	// Sources and entries follow the integration down: both foreign keys cascade.
	existing.forEach(integration => em.remove(integration))
	await em.flush()
	await seedSample(em, user)
}
