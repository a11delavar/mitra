import type { Source } from '#features/sources'
import { type Entry, TaskStatus, Transparency } from '#features/entries'
import type { Integration } from '#integrations'
import { model } from '#infrastructure/model'

/** Target capability that prevents moving an entry (evaluated up front). */
export type MigrationBlocker = 'availability' | 'recurrence' | 'occurrence' | 'participants' | 'transparency' | 'visibility' | 'percentComplete'

/** Target capability that strips an entry field on arrival. */
export type MigrationLoss = 'reminders' | 'location' | 'description' | 'attachments' | 'due' | 'estimate' | 'timeZone' | 'allDay' | 'doingStatus' | 'cancelledStatus' | 'type'

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

	/** Assesses one entry against a target's capabilities. `occurrence` marks entries entangled with
	 * edited occurrences; `occurrences` is read lazily, only when recurrence actually blocks. */
	static assess(entry: Entry, { target, capabilities, ownership, occurrence, occurrences }: {
		target: Source
		capabilities: Integration['capabilities']
		ownership: Integration['ownership']
		occurrence: boolean
		occurrences?: () => number | null
	}): MigrationVerdict {
		const blockers = new Array<MigrationBlocker>()
		const losses = new Array<MigrationLoss>()

		if (entry.type.isAvailability && !capabilities.availability) {
			blockers.push('availability')
		}
		if (occurrence) {
			blockers.push('occurrence')
		}
		if (entry.recurrence?.freq && !ownership.holds('recurrence')) {
			blockers.push('recurrence')
		}
		if (entry.participants?.length && !ownership.holds('participants')) {
			blockers.push('participants')
		}
		// Only 'Free' transparency is a blocker; default opaque is preserved implicitly.
		if (entry.transparency === Transparency.Free && !ownership.holds('transparency')) {
			blockers.push('transparency')
		}
		if (entry.visibility && !ownership.holds('visibility')) {
			blockers.push('visibility')
		}
		if (entry.percentComplete !== undefined && !ownership.holds('percentComplete')) {
			blockers.push('percentComplete')
		}

		if (entry.reminders?.length && !ownership.holds('reminders')) {
			losses.push('reminders')
		}
		if (entry.location && !ownership.holds('location')) {
			losses.push('location')
		}
		if (entry.description && !ownership.holds('description')) {
			losses.push('description')
		}
		if (entry.attachments.length && !(ownership.holds('attachments') && capabilities.entries.attach)) {
			losses.push('attachments')
		}
		if (entry.due && !ownership.holds('due')) {
			losses.push('due')
		}
		if (entry.estimate !== undefined && !ownership.holds('estimate')) {
			losses.push('estimate')
		}
		// Floating time zone is not a named zone, so it has no zone loss.
		if (entry.timeZone && !entry.timeZone.floating && !ownership.holds('timeZone')) {
			losses.push('timeZone')
		}
		if (entry.allDay && !ownership.holds('allDay')) {
			losses.push('allDay')
		}
		if (entry.status === TaskStatus.Doing && !capabilities.entries.statuses.includes(TaskStatus.Doing)) {
			losses.push('doingStatus')
		}
		if (entry.status === TaskStatus.Cancelled && !capabilities.entries.statuses.includes(TaskStatus.Cancelled)) {
			losses.push('cancelledStatus')
		}
		if (!target.supportsEntryType(entry.type)) {
			losses.push('type')
		}

		return new MigrationVerdict({
			entryId: entry.id!,
			heading: entry.heading,
			blockers,
			losses,
			occurrences: !blockers.includes('recurrence') ? null : occurrences?.() ?? null,
		})
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
			case 'attachments': return t('${count:pluralityNumber} lose their attachments', { count })
			case 'due': return t('${count:pluralityNumber} lose their due date', { count })
			case 'estimate': return t('${count:pluralityNumber} lose their estimate', { count })
			case 'timeZone': return t('${count:pluralityNumber} lose their time zone', { count })
			case 'allDay': return t('${count:pluralityNumber} stop being all-day', { count })
			case 'doingStatus': return t('${count:pluralityNumber} go back to To Do', { count })
			case 'cancelledStatus': return t('${count:pluralityNumber} lose their cancelled status', { count })
			case 'type': return t('${count:pluralityNumber} become ${type}', { count, type: target.defaultEntryType.formatPlural() })
		}
	}

	/** Human-readable label for a blocker count (frontend-only). */
	static blockerLabel(blocker: MigrationBlocker, count: number): string {
		switch (blocker) {
			case 'availability': return t('${count:pluralityNumber} are availability', { count })
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
