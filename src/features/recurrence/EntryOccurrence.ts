import { z } from 'zod'
import { Entry, EntryPatch } from '#features/entries'
import { EntryOccurrenceChange, EntryOccurrenceChangeScope } from './EntryOccurrenceChange.js'

const patchOf = (fields: Partial<EntryPatch>) => Object.assign(new EntryPatch(), fields)

/**
 * One date an entry takes place on: a one-off entry has one, a recurring entry one per date its rule yields. Its `entry`
 * holds what it shows: the one-off entry, the recurring entry, or the override standing in for this date.
 */
export class EntryOccurrence {
	/** An occurrence as a request names it, by its original start: an instant, or the day an all-day one is kept on (`2026-10-21`). */
	static readonly idConverter = {
		schema: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
		construct: (value: string | undefined) => value === undefined ? value : new Date(value),
	}

	constructor(
		readonly entry: Entry,
		readonly start: DateTime | undefined,
		readonly end: DateTime | undefined,
		readonly due: DateTime | undefined,
		/** The date the rule gave it, none for a one-off entry's. */
		readonly recurrenceId?: DateTime,
		/** The entry whose rule gave it, where it is known. */
		readonly recurringEntry?: Entry,
	) { }

	/**
	 * CSS-ident-safe, as anchor and view-transition names take it, the same in every zone (an all-day date by its UTC day)
	 * and the same once an override stands in for the date.
	 */
	get key() {
		const recurrenceId = this.storedRecurrenceId
		return !recurrenceId ? this.entry.id : `${this.recurringEntryId}__${recurrenceId.getTime()}`
	}

	/** Its date as the recurring entry stores it: an all-day one names each by its UTC midnight, whatever an edit made of this one. */
	get storedRecurrenceId() {
		return this.recurrenceId && new Date(Entry.storedDay(this.recurrenceId, this.recurringEntry ?? this.entry)!.valueOf())
	}

	/** Whether a rule gave it. */
	get recurring() {
		return !!this.recurrenceId
	}

	/** The id of the entry whose rule gave it. */
	get recurringEntryId() {
		return !this.recurrenceId ? undefined : this.recurringEntry?.id ?? this.entry.recurringEntryId
	}

	/** The occurrence the rule starts from, where "this and following" would reach the whole entry. */
	get first() {
		const recurring = this.recurringEntry
		return !!this.recurrenceId && !!recurring && this.recurrenceId.getTime() === (recurring.start ?? recurring.due)?.getTime()
	}

	get allDay() {
		return !!this.entry.allDay
	}

	/** Only a start places it: a due is a constraint. */
	get scheduled() {
		return !!this.start
	}

	/** A task planned at a moment only, with no end. */
	get point() {
		return !!this.entry.type?.isTask && !!this.start && !this.end
	}

	/** The exclusive end to measure against: an all-day day without an end lasts the day. */
	get effectiveEnd(): DateTime {
		const start = this.start!
		if (this.end && this.end.valueOf() > start.valueOf()) {
			return this.end
		}
		return this.allDay ? start.dayStart.add({ days: 1 }) : start
	}

	/** The last day it covers, as all-day ends are the next midnight. */
	get inclusiveEnd(): DateTime {
		return this.allDay ? this.effectiveEnd.subtract({ days: 1 }) : this.effectiveEnd
	}

	get multiDay() {
		return !!this.start && !!this.end && this.inclusiveEnd.dayStart.valueOf() > this.start.dayStart.valueOf()
	}

	/** The day a task is owed on: its due, else the last day its schedule covers. */
	get lastDay() {
		return this.due?.dayStart ?? (!this.start ? undefined : this.inclusiveEnd.dayStart)
	}

	/** What reminders count back from: the start, else an unscheduled task's due. */
	get reminderAnchor(): DateTime | undefined {
		return this.start ?? (this.entry.type?.isTask ? this.due : undefined)
	}

	get remindersAnchorToEnd() {
		return !this.start && !!this.reminderAnchor
	}

	/** Floating times resolve in the observer's `zone`. */
	reminderAnchorInstant(zone?: string): number | undefined {
		const anchor = this.reminderAnchor?.getTime()
		if (anchor === undefined || !this.entry.floating || !zone) {
			return anchor
		}
		return Temporal.Instant.fromEpochMilliseconds(anchor).toZonedDateTimeISO('UTC').toPlainDateTime()
			.toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds
	}

	/** Compared by day. A recurring task is never behind: its next occurrence settles a missed one. */
	get overdue() {
		const { entry } = this
		if (!entry.type?.isTask || entry.closed || this.recurring || entry.partOfSeries) {
			return false
		}
		return !!this.lastDay && this.lastDay.isBefore(new DateTime().dayStart)
	}

	/**
	 * What editing this occurrence changes in `scope`: 'this' detaches it, 'following' splits the rule here, 'all' rewrites
	 * the entry. A calendar in the patch moves what the scope reaches.
	 */
	edit(patch: EntryPatch, scope: EntryOccurrenceChangeScope): EntryOccurrenceChange {
		// Absent dates are the occurrence's own, never the entry's: its start would move the rule to its first occurrence.
		const edited = new Entry({ type: this.recurringEntry!.type })
			.patch(EntryPatch.of(this.recurringEntry!, EntryPatch.occurrence))
			.patch(patchOf({ start: this.start ?? null, end: this.end ?? null, due: this.due ?? null }))
			.patch(patch)
		switch (scope) {
			case EntryOccurrenceChangeScope.This:
				return this.detached(edited)
			case EntryOccurrenceChangeScope.Following:
				return this.split(edited)
			default:
				return this.rewritten(edited)
		}
	}

	/**
	 * The occurrence as an entry of its own, rather than a RECURRENCE-ID override: RFC 4791 keeps one UID to a resource,
	 * and Mitra stores one .ics per row. Overrides other clients wrote still render from their own rows.
	 */
	private detached(edited: Entry) {
		const entry = this.recurringEntry!
		const standalone = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), type: entry.type }).patch(EntryPatch.of(edited, EntryPatch.occurrence))
		return new EntryOccurrenceChange({ entry, excluded: this.recurrenceId, created: standalone })
	}

	/** The rule ends before this occurrence, and a new one carries on from the edit. */
	private split(edited: Entry) {
		const entry = this.recurringEntry!
		const recurrenceId = this.recurrenceId!
		const rule = entry.recurrence!
		// Before the truncation, which rewrites the rule this counts.
		const consumed = rule.count ? entry.occurrences.generatedBefore(recurrenceId) : 0
		const continuation = new Entry({
			id: crypto.randomUUID(),
			uid: crypto.randomUUID(),
			type: entry.type,
			exdates: this.shifted(entry.occurrences.excluded.filter(ms => ms >= recurrenceId.getTime()), edited),
		})
			.patch(EntryPatch.of(edited, EntryPatch.occurrence))
			.patch(patchOf({ recurrence: rule.asContinuation(consumed).rebased(...this.days(edited)) }))
		return new EntryOccurrenceChange({ entry, rewritten: this.truncated, created: continuation })
	}

	/** The whole entry moved as this occurrence was, adopting the edit's duration (none for a moment). */
	private rewritten(edited: Entry) {
		const entry = this.recurringEntry!
		const editedAnchor = this.anchorOf(edited)
		const anchor = new DateTime(this.moved((entry.start ?? entry.due)!, edited))
		const start = entry.start ? anchor : undefined
		const rewritten = new Entry({
			id: edited.sourceId !== entry.sourceId ? crypto.randomUUID() : undefined,
			uid: entry.uid,
			type: entry.type,
			exdates: this.shifted(entry.occurrences.excluded, edited),
		})
			.patch(EntryPatch.of(edited, EntryPatch.occurrence))
			.patch(patchOf({
				start: start ?? null,
				end: start && edited.start && edited.end ? new DateTime(start.getTime() + edited.end.getTime() - edited.start.getTime()) : null,
				// The due keeps the offset from the anchor the edit gave it.
				due: edited.due ? new DateTime(anchor.getTime() + edited.due.getTime() - editedAnchor.getTime()) : null,
				recurrence: entry.recurrence!.rebased(...this.days(edited)),
			}))
		return new EntryOccurrenceChange({ entry, rewritten })
	}

	/** What the rule iterates in `edited`: the start, or the due of an unscheduled task. */
	private anchorOf(edited: Entry) {
		return (this.recurringEntry!.start ? edited.start : edited.due)!
	}

	/** The day this occurrence fell on and the day the edit moves it to, each read where it stands: all-day or timed, in its zone. */
	private days(edited: Entry) {
		return [this.recurringEntry!.occurrences.zone.dayOf(this.recurrenceId!), edited.occurrences.zone.dayOf(this.anchorOf(edited))] as const
	}

	/**
	 * Where a date of the recurring entry lands once moved as this occurrence was. Within one frame by wall clock, as a DST
	 * change between them would leave it an hour off; into another (all-day or timed, another zone) by the same days, at
	 * the edit's time there, as the distance between a day and an instant means nothing.
	 */
	private moved(date: Date, edited: Entry) {
		const from = this.recurringEntry!.occurrences.zone
		const to = edited.occurrences.zone
		const anchor = this.anchorOf(edited)
		if (!!edited.allDay === !!this.recurringEntry!.allDay && from.equals(to)) {
			return from.shift(date, this.recurrenceId!, anchor)
		}
		const [was, is] = this.days(edited)
		const day = from.dayOf(date).add({ days: was.until(is).days })
		return edited.allDay ? to.midnightOf(day) : to.shift(anchor, to.midnightOf(is), to.midnightOf(day))
	}

	/** Exclusions moved as the edit moved this occurrence. Matched by instant, one left behind would bring back the occurrence it hid. */
	private shifted(exdates: ReadonlyArray<number>, edited: Entry) {
		return !exdates.length ? undefined : exdates.map(ms => this.moved(new Date(ms), edited).getTime())
	}

	/** What deleting this occurrence changes in `scope`. */
	delete(scope: EntryOccurrenceChangeScope): EntryOccurrenceChange {
		const entry = this.recurringEntry!
		return scope === EntryOccurrenceChangeScope.All ? new EntryOccurrenceChange({ entry, removed: true })
			: scope === EntryOccurrenceChangeScope.Following ? new EntryOccurrenceChange({ entry, rewritten: this.truncated })
				: new EntryOccurrenceChange({ entry, excluded: this.recurrenceId })
	}

	/** The entry with its rule ending before this occurrence. */
	private get truncated() {
		const entry = this.recurringEntry!
		return new Entry({ uid: entry.uid, type: entry.type })
			.patch(EntryPatch.of(entry, EntryPatch.occurrence))
			.patch(patchOf({ recurrence: entry.recurrence!.endingBefore(this.recurrenceId!) }))
	}

	/**
	 * An override of this date (RFC 5545 RECURRENCE-ID): the recurring entry's content at this occurrence's dates, which an
	 * edit through it changes. It shows the rule, which it never expands, and bears the occurrence's key until it is saved.
	 */
	override() {
		const entry = this.recurringEntry!
		return new Entry({
			id: this.key,
			sourceId: entry.sourceId,
			type: entry.type,
			heading: entry.heading,
			description: entry.description,
			location: entry.location,
			color: entry.color,
			status: entry.status,
			percentComplete: entry.percentComplete,
			rank: entry.rank,
			transparency: entry.transparency,
			visibility: entry.visibility,
			allDay: entry.allDay,
			timeZone: entry.timeZone,
			reminders: entry.reminders,
			participants: entry.participants,
			relations: entry.relations,
			start: this.start,
			end: this.end,
			due: this.due,
			estimate: entry.estimate,
			uid: entry.uid,
			recurrence: entry.recurrence,
			recurringEntryId: entry.id,
			recurrenceId: this.recurrenceId,
		})
	}
}
