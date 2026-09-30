import { type EntityManager } from '@mikro-orm/sqlite'
import { DateTime } from '@3mo/date-time'
import { Source } from '../../features/sources/Source.js'
import { RelationType } from '../../features/relations/RelationType.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { ParticipantRole, ParticipantStatus } from '../../features/participants/Participant.js'
import { model } from '../../infrastructure/model/model.js'
import { integration } from '../Integration.js'
import { MitraCalendar } from '../mitra/MitraCalendar.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { EntryRelation } from '../../features/relations/EntryRelation.js'
import { Entry, TaskStatus } from '../../features/entries/Entry.js'
import { Color } from '../../features/sources/Color.js'
import { normalizeAllDay } from '../../features/time/calendarDate.js'

/** The signed-in user's address in the sample data. */
const me = 'me@example.com'

/** Sample calendars, offered only with `MITRA_DEV` and given to every `MITRA_DEMO` visitor. See AGENTS.md §The Sample Calendar. */
@model('Demo')
@integration('demo')
export class Demo extends MitraCalendar {
	static override readonly label: string = 'Demo'
	static override readonly logo: string = 'demo'
	static override readonly description: string = 'Sample calendars filled with generated data, rebuilt daily'
	static override readonly developmentOnly: boolean = true
	static override readonly discoversSources: boolean = true

	static override readonly uri: string = 'mitra://demo'

	/** Their uris identify them on reconcile, so never change them. */
	private static readonly calendars = [
		{ slug: 'personal', name: 'Personal', color: Color.Green },
		{ slug: 'hobbies', name: 'Hobbies', color: Color.Purple },
		{ slug: 'university', name: 'University', color: Color.Yellow },
		{ slug: 'work', name: 'Work', color: Color.Blue },
		{ slug: 'upkeep', name: 'Upkeep', color: Color.Grey },
	]

	static sampleUri(slug: string) {
		return `mitra://sample/${slug}`
	}

	/** Turned back on so the sample data shows participants. */
	override get capabilities() {
		return { ...super.capabilities, participants: true }
	}

	/** Hourly, enough to notice the day changing. */
	override get syncInterval() { return 60 * 60 * 1000 }

	private static dayOf(today: DateTime) {
		return `${today.year}-${today.month}-${today.day}`
	}

	/** Adds back missing sample calendars and keeps everything already stored. */
	protected override fetchSources(existing?: ReadonlyArray<Source>): Promise<Array<Source>> {
		const sources = [...existing ?? []]
		for (const calendar of Demo.calendars) {
			if (!sources.some(source => source.uri === Demo.sampleUri(calendar.slug))) {
				sources.push(new Source({ uri: Demo.sampleUri(calendar.slug), name: calendar.name, color: calendar.color, enabled: true, hidden: false }))
			}
		}
		return Promise.resolve(sources)
	}

	/**
	 * Both the importer and the sync daemon call this. Seeding covers every source at once,
	 * so only the first call of a new day does any work.
	 */
	override async syncSource(em: EntityManager, source: Source): Promise<boolean> {
		const reseeded = await this.reseedIfStale(em)
		return await super.syncSource(em, source) || reseeded
	}

	/** Re-import rebuilds the sample data. */
	override get reimportable() { return true }

	/** Clears the day anchor and hands the source back to the importer, which reseeds. */
	override async reimportSource(em: EntityManager, source: Source): Promise<void> {
		this.credentials = { ...this.credentials, seededFor: undefined }
		source.awaitImport()
		await em.flush()
	}

	private async reseedIfStale(em: EntityManager): Promise<boolean> {
		const today = new DateTime()
		if (this.credentials?.seededFor === Demo.dayOf(today)) {
			return false
		}

		const sources = await em.find(Source, { integrationId: this.id })
		const stale = await em.find(Entry, { sourceId: { $in: sources.map(source => source.id) } })
		stale.forEach(entry => em.remove(entry))
		await em.flush()

		this.addresses = [me]
		// The sidebar heads an account with its username; the sample one reads like any connected account.
		this.credentials = { ...this.credentials, username: me, seededFor: Demo.dayOf(today) }
		this.seed(em, sources, today)
		return true
	}

	private seed(em: EntityManager, sources: ReadonlyArray<Source>, today: DateTime) {
		const calendar = (slug: string) => sources.find(source => source.uri === Demo.sampleUri(slug))!

		const personal = calendar('personal')
		const hobbies = calendar('hobbies')
		const university = calendar('university')
		const work = calendar('work')
		const upkeep = calendar('upkeep')

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

		// Five minutes draws as a hairline: a daily mark in the year view without a bar in the week.
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

		// The one chain near today. It must stay in the CURRENT week, since the app opens on today−2…today+4.
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
	}
}
