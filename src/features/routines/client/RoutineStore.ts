import { Controller } from '@a11d/lit'
import { type ReactiveControllerHost } from 'lit'
import { DateTime } from '@3mo/date-time'
import { CompleteTask, ListRoutineEntries, ListRoutines } from '#operations'
import { EntryStatus, type Entry } from '#features/entries'
import { EntryOccurrenceChangeScope, type EntryOccurrence } from '#features/recurrence'
import { TimeZone } from '#features/time/TimeZone.js'
import { Calendars } from '#features/sources/client/Calendars.js'
import { EntryStore, reportSaveError } from '#features/entries/client/EntryStore.js'
import type { Routine } from '../Routine.js'
import { RoutineEntries } from '../RoutineEntries.js'
import { type RoutineEntryOccurrences } from '../RoutineEntryOccurrences.js'
import { RoutineEntryOccurrenceStatus } from '../RoutineEntryOccurrenceStatus.js'

/** Where the tab lists a routine: with a date today, or later. */
export type RoutineSection = 'today' | 'later'

/**
 * The routines as the server last listed them, by id: fetched beside the entries, and while the tab reads them
 * (`showing`) with a year of their entries, whose dates it reads here as the views read theirs. Hosts render again when
 * they change. What is done to today's date of a routine goes through here too, on the calendar where the window holds
 * it, else where it is.
 */
export class RoutineStore extends Controller {
	/** How many of their last dates the tab shows, and counts kept among. */
	static readonly strip = 14

	private static readonly hosts = new Set<ReactiveControllerHost>()

	static routines: ReadonlyMap<string, Routine> = new Map()

	/** Each routine's entries, by its id, while the tab reads them. */
	private static entries?: ReadonlyMap<string, RoutineEntries>

	/** Each routine's dates as last read, by its id, while the tab reads them. */
	private static dates?: ReadonlyMap<string, RoutineEntryOccurrences>

	private static _showing = false
	/** Whether the tab is read: the routines' entries are then fetched beside them. */
	static get showing() { return RoutineStore._showing }
	static set showing(value) {
		if (value !== RoutineStore._showing) {
			RoutineStore._showing = value
			if (value) {
				void RoutineStore.refresh()
			} else {
				RoutineStore.entries = RoutineStore.dates = undefined
			}
		}
	}

	/** Whether the routines' entries came, as the tab reads them. */
	static get loaded() {
		return RoutineStore.showing && !!RoutineStore.dates
	}

	/** What `GET /routines/entries` is asked: a year back, which the detail's grid shows, as every rule comes whole. */
	static get query() {
		return { since: new DateTime().dayStart.subtract({ years: 1 }) }
	}

	static adopt(routines: ReadonlyArray<Routine>, entries?: ReadonlyArray<Entry>) {
		RoutineStore.routines = new Map(routines.map(routine => [routine.id, routine]))
		if (entries) {
			const members = Map.groupBy(entries, entry => entry.routineId)
			const now = new Date()
			RoutineStore.entries = new Map(routines.map(routine => [routine.id, RoutineEntries.of(members.get(routine.id) ?? [])]))
			RoutineStore.dates = new Map([...RoutineStore.entries].map(([id, each]) => [id, each.occurrencesAt(now, TimeZone.localOrDefault)]))
		}
		RoutineStore.hosts.forEach(host => host.requestUpdate())
	}

	private static pending?: Promise<void>
	private static again = false

	/** Fetches the routines and their entries again, once at a time: a call while one runs fetches once more after it. */
	static refresh(): Promise<void> {
		if (RoutineStore.pending) {
			RoutineStore.again = true
			return RoutineStore.pending
		}
		return RoutineStore.pending = (async () => {
			try {
				do {
					RoutineStore.again = false
					const [routines, entries] = await Promise.all([ListRoutines.call(), ListRoutineEntries.call(RoutineStore.query)])
					RoutineStore.adopt(routines, RoutineStore.showing ? entries : undefined)
				} while (RoutineStore.again)
			} catch (error) {
				console.warn('Fetching the routines failed:', error)
			} finally {
				RoutineStore.pending = undefined
			}
		})()
	}

	/** A routine's entries, while the tab reads them. */
	static entriesOf(routine: Routine) {
		return RoutineStore.entries?.get(routine.id)
	}

	/** A routine's dates, while the tab reads them. */
	static datesOf(routine: Routine) {
		return RoutineStore.dates?.get(routine.id)
	}

	/** The rule a routine comes by now: its next date's, else the tightest among its entries, which says best how often it comes. */
	static ruleOf(routine: Routine) {
		const next = RoutineStore.datesOf(routine)?.next
		return next?.recurringEntry?.recurrence ?? RoutineStore.entriesOf(routine)?.tightest?.recurrence
	}

	/** The time of day a routine comes at, read off its next date, where that has one. */
	static timeOf(routine: Routine) {
		const next = RoutineStore.datesOf(routine)?.next
		return next?.start && !next.entry.allDay ? next.start.format({ timeStyle: 'short' }) : undefined
	}

	/** Whether a routine is kept by ticking tasks off, as its newest date is. */
	static isTask(routine: Routine) {
		const dates = RoutineStore.datesOf(routine)
		return !!(dates?.next ?? dates?.last(1)[0])?.entry.type.isTask
	}

	/** Those of the visible calendars, with their dates: the tab follows the calendars' eye. */
	static get visible() {
		const visible = new Set(Calendars.visible.map(source => source.id))
		return [...RoutineStore.routines.values()].filter(routine => RoutineStore.datesOf(routine) && visible.has(routine.sourceId))
	}

	/** The badge: routine tasks whose date today is still open, read off the calendar's own, as it holds today. */
	static get dueToday() {
		const today = new DateTime().dayStart
		return EntryStore.shown.filter(occurrence => {
			const id = occurrence.entry.routineId ?? occurrence.recurringEntry?.routineId
			const date = occurrence.start ?? occurrence.due
			return id && RoutineStore.routines.has(id) && occurrence.entry.type.isTask && !occurrence.entry.closed && !!date && new DateTime(date.valueOf()).dayStart.equals(today)
		}).length
	}

	/** Whether today's task of a routine can be ticked off: its calendar takes edits. */
	static ticks(routine: Routine) {
		return RoutineStore.isTask(routine) && !!Calendars.getSource(routine.sourceId)?.capabilities.entries.edit
	}

	/** Whether today's date can be called off, as the editor's status can: a calendar that takes it, and keeps it. */
	static cancels(routine: Routine) {
		const source = Calendars.getSource(routine.sourceId)
		return !!source?.capabilities.entries.edit && source.capabilities.entries.statuses.includes(EntryStatus.Cancelled)
	}

	/** A routine's date today, whatever became of it: still open, kept or called off. */
	static onToday(routine: Routine) {
		const dates = RoutineStore.datesOf(routine)
		const today = TimeZone.localOrDefault.dayOf(new Date())
		return [dates?.next, ...dates?.last(1) ?? []].find(date => !!date?.dayIn(TimeZone.localOrDefault)?.equals(today))
	}

	/**
	 * The routines as the tab lists them: those with a date today first, by its time of day, which is what is left to do;
	 * then the rest, by their next date. What a routine is like, how often it comes or its calendar, its card tells.
	 */
	static sectionsOf(routines: ReadonlyArray<Routine>) {
		const at = (date?: EntryOccurrence) => (date?.start ?? date?.due)?.valueOf() ?? Infinity
		const today = routines.filter(routine => RoutineStore.onToday(routine))
		const later = routines.filter(routine => !today.includes(routine))
		return [
			{ section: 'today', routines: today.toSorted((a, b) => at(RoutineStore.onToday(a)) - at(RoutineStore.onToday(b))) },
			{ section: 'later', routines: later.toSorted((a, b) => at(RoutineStore.datesOf(a)?.next) - at(RoutineStore.datesOf(b)?.next)) },
		].filter(({ routines }) => routines.length > 0) as Array<{ readonly section: RoutineSection, readonly routines: ReadonlyArray<Routine> }>
	}

	static get sections() {
		return RoutineStore.sectionsOf(RoutineStore.visible)
	}

	/** Today's date of a routine, unless it was called off: still open, or already kept. */
	static todayOf(routine: Routine) {
		const date = RoutineStore.onToday(routine)
		return date && RoutineStore.datesOf(routine)!.statusOf(date) !== RoutineEntryOccurrenceStatus.Cancelled ? date : undefined
	}

	/** The calendar's occurrence of a routine's date, where the window holds it. */
	static occurrenceOf(date: EntryOccurrence) {
		return EntryStore.occurrences.find(occurrence => occurrence.key === date.key)
	}

	/** Ticks today's task of a routine off, as the tick on the calendar does. */
	static async completeToday(routine: Routine) {
		const today = RoutineStore.todayOf(routine)
		const occurrence = today && RoutineStore.occurrenceOf(today)
		if (occurrence) {
			const entry = EntryStore.editable(occurrence)
			entry.status = EntryStatus.Done
			EntryStore.notify()
			await EntryStore.commit(entry).catch(reportSaveError)
		} else if (today && RoutineStore.datesOf(routine)?.statusOf(today) === RoutineEntryOccurrenceStatus.Open) {
			// Out of the calendar's window, today's date is completed where it is; reopening it takes the calendar.
			await CompleteTask.call({ id: today.entry.id!, occurrence: today.recurring && today.entry === today.recurringEntry ? today.storedRecurrenceId : undefined }).catch(reportSaveError)
		}
		await RoutineStore.refresh()
	}

	/** Calls today's date off, as the editor's status does: this date alone. */
	static async cancelToday(routine: Routine) {
		const today = RoutineStore.todayOf(routine)
		const occurrence = today && RoutineStore.occurrenceOf(today)
		if (!occurrence || !RoutineStore.cancels(routine)) {
			return
		}
		const entry = EntryStore.editable(occurrence)
		entry.status = EntryStatus.Cancelled
		EntryStore.notify()
		await EntryStore.commit(entry, EntryOccurrenceChangeScope.This).catch(reportSaveError)
		await RoutineStore.refresh()
	}

	constructor(host: ReactiveControllerHost) {
		super(host as never)
	}

	override hostConnected() {
		RoutineStore.hosts.add(this.host)
	}

	override hostDisconnected() {
		RoutineStore.hosts.delete(this.host)
	}
}
