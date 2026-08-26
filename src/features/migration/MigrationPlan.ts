import { model } from '../../infrastructure/model/model.js'
import { type Source } from '../sources/Source.js'

/** Target capability that prevents moving an entry (evaluated up front). */
export type MigrationBlocker = 'recurrence' | 'occurrence' | 'participants' | 'transparency' | 'visibility' | 'percentComplete'

/** Target capability that strips an entry field on arrival. */
export type MigrationLoss = 'reminders' | 'location' | 'description' | 'timeZone' | 'allDay' | 'cancelledStatus' | 'type'

/** Single entry assessment (blockers and field losses). */
@model('MigrationVerdict')
export class MigrationVerdict {
	entryId = ''
	heading = ''
	blockers = new Array<MigrationBlocker>()
	losses = new Array<MigrationLoss>()
	/** Number of single occurrences if flattened; null if unexpandable. */
	occurrences: number | null = null

	constructor(init?: Partial<MigrationVerdict>) {
		Object.assign(this, init)
	}

	/** True if entry moves with all fields intact. */
	get clean() {
		return !this.blockers.length && !this.losses.length
	}

	/** True if entry is blocked only by recurrence and can be flattened. */
	get flattenable() {
		return this.occurrences !== null && this.blockers.includes('recurrence')
	}

	blockersUnder(flatten: boolean) {
		return flatten && this.flattenable ? this.blockers.filter(blocker => blocker !== 'recurrence') : this.blockers
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

	/** Human-readable label for a field loss count (frontend-only). */
	static lossLabel(loss: MigrationLoss, count: number, target: Source): string {
		switch (loss) {
			case 'reminders': return t('${count:pluralityNumber} lose their reminders', { count })
			case 'location': return t('${count:pluralityNumber} lose their location', { count })
			case 'description': return t('${count:pluralityNumber} lose their description', { count })
			case 'timeZone': return t('${count:pluralityNumber} lose their time zone', { count })
			case 'allDay': return t('${count:pluralityNumber} stop being all-day', { count })
			case 'cancelledStatus': return t('${count:pluralityNumber} lose their cancelled status', { count })
			case 'type': return t('${count:pluralityNumber} become ${type}', { count, type: target.defaultEntryType.formatPlural() })
		}
	}

	/** Human-readable label for a blocker count (frontend-only). */
	static blockerLabel(blocker: MigrationBlocker, count: number): string {
		switch (blocker) {
			case 'recurrence': return t('${count:pluralityNumber} repeat', { count })
			case 'occurrence': return t('${count:pluralityNumber} belong to a series with edited occurrences', { count })
			case 'participants': return t('${count:pluralityNumber} have participants', { count })
			case 'transparency': return t('${count:pluralityNumber} are marked as free', { count })
			case 'visibility': return t('${count:pluralityNumber} carry a visibility', { count })
			case 'percentComplete': return t('${count:pluralityNumber} carry a progress percentage', { count })
		}
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
	failure: string | null = null
	failedEntry: string | null = null

	constructor(init?: Partial<MigrationOutcome>) {
		Object.assign(this, init)
	}

	get aborted() {
		return this.failure !== null
	}
}
