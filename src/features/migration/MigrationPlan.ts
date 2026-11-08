import { converter, type Converter } from '@a11d/converter'
import { z } from 'zod'
import type { Source } from '#features/sources'
import { Entry, EntryStatus, whereUnsupported, type UnsupportedField } from '#features/entries'
import { model } from '#infrastructure/model'

/** Each by its name on the wire, one instance a name, so a tally counts them by identity. */
const named = <T extends { readonly name: string }>(all: () => ReadonlyArray<T>): Converter<ReadonlyArray<string> | undefined, Array<T> | undefined> => ({
	schema: z.array(z.string()),
	construct: names => names?.flatMap(name => all().filter(each => each.name === name)),
	deconstruct: values => values?.map(value => value.name),
})

/** What keeps an entry out of a calendar altogether, told as how many it keeps out. */
export class MigrationBlocker {
	static readonly Availability = new MigrationBlocker('availability')
	static readonly Recurrence = new MigrationBlocker('recurrence')
	static readonly Occurrence = new MigrationBlocker('occurrence')
	static readonly Participants = new MigrationBlocker('participants')
	static readonly Transparency = new MigrationBlocker('transparency')
	static readonly Visibility = new MigrationBlocker('visibility')
	static readonly PercentComplete = new MigrationBlocker('percentComplete')

	static readonly all: ReadonlyArray<MigrationBlocker> = [
		MigrationBlocker.Availability, MigrationBlocker.Recurrence, MigrationBlocker.Occurrence, MigrationBlocker.Participants,
		MigrationBlocker.Transparency, MigrationBlocker.Visibility, MigrationBlocker.PercentComplete,
	]

	static readonly converter = named(() => MigrationBlocker.all)

	/** The blocker a field a calendar does not support declares, by its name. */
	static of(field: UnsupportedField) {
		return MigrationBlocker.all.find(blocker => blocker.name === field.name)!
	}

	private constructor(readonly name: string) { }

	format(count: number) {
		return String(this.phrase(count))
	}

	private phrase(count: number) {
		switch (this) {
			case MigrationBlocker.Availability: return t('${count:pluralityNumber} are availability', { count })
			case MigrationBlocker.Recurrence: return t('${count:pluralityNumber} repeat', { count })
			case MigrationBlocker.Occurrence: return t('${count:pluralityNumber} belong to a series with edited occurrences', { count })
			case MigrationBlocker.Participants: return t('${count:pluralityNumber} have participants', { count })
			case MigrationBlocker.Transparency: return t('${count:pluralityNumber} are marked as free', { count })
			case MigrationBlocker.Visibility: return t('${count:pluralityNumber} carry a visibility', { count })
			case MigrationBlocker.PercentComplete: return t('${count:pluralityNumber} carry a progress percentage', { count })
			default: return this.name
		}
	}

	toString() {
		return this.name
	}
}

/** What an entry loses on arriving in a calendar that does not keep it, told as how many lose it there. */
export class MigrationLoss {
	static readonly Reminders = new MigrationLoss('reminders')
	static readonly Location = new MigrationLoss('location')
	static readonly Description = new MigrationLoss('description')
	static readonly Attachments = new MigrationLoss('attachments')
	static readonly End = new MigrationLoss('end')
	static readonly Due = new MigrationLoss('due')
	static readonly Estimate = new MigrationLoss('estimate')
	static readonly TimeZone = new MigrationLoss('timeZone')
	static readonly Floating = new MigrationLoss('floating')
	static readonly AllDay = new MigrationLoss('allDay')
	static readonly DoingStatus = new MigrationLoss('doingStatus')
	static readonly CancelledStatus = new MigrationLoss('cancelledStatus')
	static readonly Type = new MigrationLoss('type')

	static readonly all: ReadonlyArray<MigrationLoss> = [
		MigrationLoss.Reminders, MigrationLoss.Location, MigrationLoss.Description, MigrationLoss.Attachments, MigrationLoss.End,
		MigrationLoss.Due, MigrationLoss.Estimate, MigrationLoss.TimeZone, MigrationLoss.Floating, MigrationLoss.AllDay,
		MigrationLoss.DoingStatus, MigrationLoss.CancelledStatus, MigrationLoss.Type,
	]

	static readonly converter = named(() => MigrationLoss.all)

	/** The loss a field a calendar does not support declares, by its name. */
	static of(field: UnsupportedField) {
		return MigrationLoss.all.find(loss => loss.name === field.name)!
	}

	private constructor(readonly name: string) { }

	/** How many lose it in `target`, whose default type a converted entry takes. */
	format(count: number, target: Source) {
		return String(this.phrase(count, target))
	}

	private phrase(count: number, target: Source) {
		switch (this) {
			case MigrationLoss.Reminders: return t('${count:pluralityNumber} lose their reminders', { count })
			case MigrationLoss.Location: return t('${count:pluralityNumber} lose their location', { count })
			case MigrationLoss.Description: return t('${count:pluralityNumber} lose their description', { count })
			case MigrationLoss.Attachments: return t('${count:pluralityNumber} lose their attachments', { count })
			case MigrationLoss.End: return t('${count:pluralityNumber} lose their end date', { count })
			case MigrationLoss.Due: return t('${count:pluralityNumber} lose their due date', { count })
			case MigrationLoss.Estimate: return t('${count:pluralityNumber} lose their estimate', { count })
			case MigrationLoss.TimeZone: return t('${count:pluralityNumber} lose their time zone', { count })
			case MigrationLoss.Floating: return t('${count:pluralityNumber} get a fixed time zone', { count })
			case MigrationLoss.AllDay: return t('${count:pluralityNumber} stop being all-day', { count })
			case MigrationLoss.DoingStatus: return t('${count:pluralityNumber} go back to To Do', { count })
			case MigrationLoss.CancelledStatus: return t('${count:pluralityNumber} lose their cancelled status', { count })
			case MigrationLoss.Type: return t('${count:pluralityNumber} become ${type}', { count, type: target.defaultEntryType.formatPlural() })
			default: return this.name
		}
	}

	toString() {
		return this.name
	}
}

/** What moving one entry into a calendar would do to it: what blocks it, what it loses there. */
@model('MigrationVerdict')
export class MigrationVerdict {
	entryId = ''
	heading = ''
	@converter(MigrationBlocker.converter) blockers = new Array<MigrationBlocker>()
	@converter(MigrationLoss.converter) losses = new Array<MigrationLoss>()
	/** How many dates a flattened series would become; none where it cannot be expanded. */
	occurrences?: number

	constructor(init?: Partial<MigrationVerdict>) {
		Object.assign(this, init)
	}

	/**
	 * What moving `entry` into `target` would do: what keeps it out, and what it loses there. `occurrence` marks an entry entangled
	 * with edited occurrences, which only a migration knows; `occurrences` counts the dates a flattened series would become, read
	 * only where its recurrence blocks.
	 */
	static of(entry: Entry, target: Source, { occurrence = false, occurrences }: { occurrence?: boolean, occurrences?: () => number | null } = {}) {
		const { capabilities } = target
		const blockers = new Array<MigrationBlocker>()
		const losses = new Array<MigrationLoss>()

		if (entry.type.isAvailability && !capabilities.availability) {
			blockers.push(MigrationBlocker.Availability)
		}
		if (occurrence) {
			blockers.push(MigrationBlocker.Occurrence)
		}
		for (const field of whereUnsupported.fieldsOf(Entry)) {
			if (field.move === 'block' && field.unsupportedIn(target, entry)) {
				blockers.push(MigrationBlocker.of(field))
			} else if (field.move === 'drop' && field.unsupportedIn(target, entry)) {
				losses.push(MigrationLoss.of(field))
			}
		}
		// A calendar may keep attachments yet drop those written to it, as Google does.
		if (entry.attachments.length && target.ownership.holds('attachments') && !capabilities.entries.attach) {
			losses.push(MigrationLoss.Attachments)
		}
		if (entry.floating && !capabilities.entries.floating) {
			losses.push(MigrationLoss.Floating)
		}
		if (entry.status === EntryStatus.Doing && !capabilities.entries.statuses.includes(EntryStatus.Doing)) {
			losses.push(MigrationLoss.DoingStatus)
		}
		if (entry.status === EntryStatus.Cancelled && !capabilities.entries.statuses.includes(EntryStatus.Cancelled)) {
			losses.push(MigrationLoss.CancelledStatus)
		}
		if (!target.supportsEntryType(entry.type)) {
			losses.push(MigrationLoss.Type)
		}

		return new MigrationVerdict({
			entryId: entry.id ?? '',
			heading: entry.heading,
			blockers,
			losses,
			occurrences: !blockers.includes(MigrationBlocker.Recurrence) ? undefined : occurrences?.() ?? undefined,
		})
	}

	/** True if entry moves with all fields intact. */
	get clean() {
		return !this.blockers.length && !this.losses.length
	}

	/** True if entry is blocked only by recurrence and can be flattened. */
	get flattenable() {
		return this.occurrences !== undefined && this.blockers.includes(MigrationBlocker.Recurrence)
	}

	blockersUnder(flatten: boolean) {
		return flatten && this.flattenable ? this.blockers.filter(blocker => blocker !== MigrationBlocker.Recurrence) : this.blockers
	}

	moves(flatten: boolean) {
		return !this.blockersUnder(flatten).length
	}

	creations(flatten: boolean) {
		return !this.moves(flatten) ? 0 : flatten && this.flattenable ? this.occurrences! : 1
	}
}

/** Fidelity preview for batch migration: clean moves, field losses, and blocked entries. */
@model('MigrationPlan')
export class MigrationPlan {
	total = 0
	/** Non-clean verdicts only (clean count is total - verdicts.length). */
	verdicts = new Array<MigrationVerdict>()

	constructor(init?: Partial<MigrationPlan>) {
		Object.assign(this, init)
	}

	get cleanCount() {
		return this.total - this.verdicts.length
	}

	get flattenable() {
		return this.verdicts.filter(verdict => verdict.flattenable)
	}

	blocked(flatten: boolean) {
		return this.verdicts.filter(verdict => !verdict.moves(flatten))
	}

	movingCount(flatten: boolean) {
		return this.total - this.blocked(flatten).length
	}

	creations(flatten: boolean) {
		return this.cleanCount + this.verdicts.reduce((total, verdict) => total + verdict.creations(flatten), 0)
	}

	/** Tally of field losses across verdicts, sorted descending. */
	get losses() {
		return MigrationPlan.tally(this.verdicts.flatMap(verdict => verdict.losses))
	}

	/** Tally of blockers across verdicts, sorted descending. */
	blockers(flatten: boolean) {
		return MigrationPlan.tally(this.blocked(flatten).flatMap(verdict => verdict.blockersUnder(flatten)))
	}

	private static tally<T>(values: ReadonlyArray<T>) {
		return [...Map.groupBy(values, value => value)]
			.map(([value, group]) => [value, group.length] as const)
			.sort(([, a], [, b]) => b - a)
	}
}

/** Report of migration outcome across all phases. */
@model('MigrationOutcome')
export class MigrationOutcome {
	moved = 0
	created = 0
	left = 0
	duplicates = 0
	failure?: string
	failedEntry?: string

	constructor(init?: Partial<MigrationOutcome>) {
		Object.assign(this, init)
	}

	get aborted() {
		return this.failure !== undefined
	}
}
