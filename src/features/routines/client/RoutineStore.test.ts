import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime, DateTimeRange } from '@3mo/date-time'
import { Entry, EntryStatus, EntryType } from '#features/entries'
import { EntryStore } from '#features/entries/client/EntryStore.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import { Source } from '#features/sources'
import { MitraCalendar } from '#integrations/mitra/MitraCalendar.js'
import { IcsSubscription } from '#integrations/ics/IcsSubscription.js'
import { GoogleCalendar } from '#integrations/google/GoogleCalendar.js'
import { Routine } from '../Routine.js'
import { RoutineCadence } from '../RoutineCadence.js'
import { Recurrence } from '#features/recurrence'
import { RoutineStore } from './RoutineStore.js'

describe('RoutineStore', () => {
	/** A routine of one entry: repeating by `rule` from `next`, or of its own on `next`, a week from now without. */
	const routine = (id: string, init: { type?: EntryType, sourceId?: string, rule?: string, cadence?: number, next?: string } = {}) => {
		const start = new DateTime(init.next ?? new DateTime().add({ days: 7 }).toISOString())
		const entry = new Entry({ id: `${id}-entry`, sourceId: init.sourceId ?? 'home', routineId: id, type: init.type ?? EntryType.Task, heading: id, start, end: start.add({ hours: 1 }), recurrence: Recurrence.fromRRule(init.rule) })
		return { routine: new Routine({ id, sourceId: init.sourceId ?? 'home', cadence: init.cadence === undefined ? undefined : new RoutineCadence(init.cadence), titles: [id] }), entry }
	}
	/** Has the store hold `routines` with their entries, as the tab reads them. */
	const adopt = (...routines: ReadonlyArray<ReturnType<typeof routine>>) => {
		RoutineStore.adopt(routines.map(each => each.routine), routines.map(each => each.entry))
		return routines.map(each => each.routine)
	}
	const home = () => new MitraCalendar({ id: 'mitra', sources: [
		new Source({ integrationId: 'mitra', id: 'home', uri: 'mitra://local/home', name: 'Home', enabled: true, hidden: false }),
		new Source({ integrationId: 'mitra', id: 'hidden', uri: 'mitra://local/hidden', name: 'Hidden', enabled: true, hidden: true }),
	] })

	beforeEach(() => EntryStore.reset())

	it('counts for the badge the routine tasks of today still open, read off the calendar\'s own', () => {
		const today = new DateTime().dayStart
		const task = (id: string, init: Partial<Entry> = {}) => new Entry({ id, sourceId: 'home', type: EntryType.Task, heading: id, routineId: 'r', status: EntryStatus.ToDo, start: today.add({ hours: 9 }), end: today.add({ hours: 10 }), ...init })
		adopt(routine('r'))
		EntryStore.applyServerEntries([
			task('open'),
			task('done', { status: EntryStatus.Done }),
			task('tomorrow', { start: today.add({ days: 1, hours: 9 }), end: today.add({ days: 1, hours: 10 }) }),
			task('loose', { routineId: undefined }),
			task('event', { type: EntryType.Event }),
		], new DateTimeRange(today.subtract({ days: 7 }), today.add({ days: 7 })))
		assert.equal(RoutineStore.dueToday, 1)
	})

	it('follows the eye of the calendars, and shows routines only once their entries came', () => {
		Calendars.adopt([home()])
		RoutineStore.adopt([routine('meds').routine])
		assert.equal(RoutineStore.visible.length, 0)
		adopt(routine('meds'), routine('swim', { sourceId: 'hidden' }))
		assert.deepEqual(RoutineStore.visible.map(each => each.id), ['meds'])
	})

	it('offers the tick and Cancelled only where the calendar lets them be written', () => {
		Calendars.adopt([
			home(),
			new IcsSubscription({ id: 'feed', sources: [new Source({ integrationId: 'feed', id: 'feed-source', uri: 'https://example.com/feed.ics', name: 'Feed', enabled: true, hidden: false })] }),
			new GoogleCalendar({ id: 'google', sources: [new Source({ integrationId: 'google', id: 'google-source', uri: 'https://apidata.googleusercontent.com/caldav/v2/someone/events/', name: 'Google', enabled: true, hidden: false })] }),
		])
		const of = (sourceId: string, type: EntryType) => adopt(routine(`${sourceId}-${type}`, { sourceId, type }))[0]!
		assert.deepEqual([RoutineStore.ticks(of('home', EntryType.Task)), RoutineStore.ticks(of('home', EntryType.Event)), RoutineStore.ticks(of('feed-source', EntryType.Task))], [true, false, false])
		assert.deepEqual([RoutineStore.cancels(of('home', EntryType.Event)), RoutineStore.cancels(of('feed-source', EntryType.Event)), RoutineStore.cancels(of('google-source', EntryType.Event)), RoutineStore.cancels(of('home', EntryType.Task))], [true, false, false, true])
	})

	it('lists the routines with a date today first, by its time, then the rest by their next date', () => {
		const at = (days: number, hours: number) => new DateTime().dayStart.add({ days, hours }).toISOString()
		const sections = RoutineStore.sectionsOf(adopt(
			routine('volleyball', { sourceId: 'hobbies', rule: 'FREQ=WEEKLY', next: at(3, 18) }),
			routine('journal', { rule: 'FREQ=DAILY', next: at(0, 21) }),
			routine('sync', { sourceId: 'work', rule: 'FREQ=WEEKLY', next: at(1, 15) }),
			routine('meds', { rule: 'FREQ=DAILY', next: at(0, 7) }),
			routine('gym', { sourceId: 'hobbies', rule: 'FREQ=WEEKLY', next: at(2, 8) }),
		))
		assert.deepEqual(sections.map(({ section, routines }) => [section, routines.map(each => each.id)]), [
			['today', ['meds', 'journal']],
			['later', ['sync', 'gym', 'volleyball']],
		])
	})

	it('names a routine by the person\'s name, else by the titles its members wear', () => {
		assert.equal(new Routine({ name: 'Training', titles: ['Gym'] }).label, 'Training')
		assert.equal(new Routine({ titles: ['Gym', 'Workout'] }).label, 'Gym and Workout')
	})

	it('says how often it comes by its rule, else roughly by its cadence', () => {
		assert.equal(new Routine().frequency(Recurrence.fromRRule('FREQ=DAILY')), 'Every day')
		assert.equal(new Routine({ cadence: new RoutineCadence(35) }).frequency(), 'About every 5 weeks')
		assert.equal(new Routine({ cadence: new RoutineCadence(2.3) }).frequency(), 'About every 2 days')
	})
})
