import { type EntityManager } from '@mikro-orm/core'
import { type DateTime } from '@3mo/date-time'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { Integration } from '../../../integrations/Integration.js'
import { type User } from '../../identity/User.js'
import { Entry, FLOATING_TIME_ZONE, TaskStatus, Transparency } from '../../entries/Entry.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { Occurrences, exdatesOf } from '../../recurrence/server/occurrences.js'
import { MigrationOutcome, MigrationPlan, MigrationVerdict, type MigrationBlocker, type MigrationLoss } from '../MigrationPlan.js'
import { type Source } from '../../sources/Source.js'

const logger = createLogger('Migration')

const FLATTEN_HORIZON_DAYS = 366

/** Migration request cannot be fulfilled (e.g. invalid target or origin). */
export class MigrationRefused extends Error { }

/**
 * Bulk migration of entries between sources in three sequential phases:
 * 1. Copy: Create all entries in target and record old-uid -> new-uid mappings.
 * 2. Repoint: Update EntryRelation.targetUid across batch to preserve internal relationships.
 * 3. Delete: Delete originals from origin (skipped if keepOriginals is true).
 */
export interface MigrationOptions {
	readonly targetSourceId?: unknown
	/** Entry IDs to migrate; undefined means all entries in the source. */
	readonly entryIds?: unknown
	/** If true, skip delete phase (copy instead of move). */
	readonly keepOriginals?: boolean
	/** If true, write unrepeatable series as single occurrences instead of leaving them behind. */
	readonly flatten?: boolean
}

export class SourceMigration {
	private constructor(
		private readonly em: EntityManager,
		readonly origin: Source,
		private readonly originIntegration: Integration,
		readonly target: Source,
		private readonly targetIntegration: Integration,
		private readonly entries: ReadonlyArray<Entry>,
		/** Masters in the origin that have single-occurrence override rows. */
		private readonly overriddenMasterIds: ReadonlySet<string>,
		private readonly keepOriginals: boolean,
		private readonly flatten: boolean,
	) { }

	/** Resolves sources and entries for migration, validating permissions and presence. */
	static async of(em: EntityManager, user: User, originId: string, options: MigrationOptions): Promise<SourceMigration> {
		const { targetSourceId, entryIds } = options
		const keepOriginals = options.keepOriginals === true
		if (typeof targetSourceId !== 'string' || !targetSourceId) {
			throw new MigrationRefused('A target calendar is required')
		}
		if (targetSourceId === originId) {
			throw new MigrationRefused('Entries cannot move to the calendar they are already in')
		}
		if (entryIds !== undefined && (!Array.isArray(entryIds) || entryIds.some(id => typeof id !== 'string'))) {
			throw new MigrationRefused('A list of entry ids is required')
		}

		// Read-only origins permit copy, but refuse move.
		const [origin, target] = [await user.source(em, originId), await user.source(em, targetSourceId)]
		const [originIntegration, targetIntegration] = await Promise.all([
			em.findOneOrFail(Integration, { id: origin.integrationId }),
			em.findOneOrFail(Integration, { id: target.integrationId }),
		])
		if (!keepOriginals && !originIntegration.capabilitiesFor(origin).deleteEntries) {
			throw new MigrationRefused('Entries in this calendar cannot be deleted from mitra, so they can only be copied out of it')
		}
		if (!targetIntegration.capabilitiesFor(target).createEntries) {
			throw new MigrationRefused('This calendar cannot be written to from mitra')
		}

		const ids = entryIds as Array<string> | undefined
		const entries = await em.find(Entry, { sourceId: origin.id, ...ids ? { id: { $in: ids } } : {} })
		if (ids && entries.length !== new Set(ids).size) {
			throw new MigrationRefused('Some of the entries are not in this calendar')
		}

		// Identify masters with edited occurrence overrides to hold them back together.
		const overrides = await em.find(Entry, { sourceId: origin.id, recurrenceMasterId: { $ne: null } })
		const overriddenMasterIds = new Set(overrides.map(override => override.recurrenceMasterId!))

		return new SourceMigration(em, origin, originIntegration, target, targetIntegration, entries, overriddenMasterIds, keepOriginals, options.flatten === true)
	}

	/** Fidelity preview of what the migration would move, modify, or block. */
	plan(): MigrationPlan {
		const verdicts = this.entries.map(entry => this.verdictFor(entry))
		return new MigrationPlan({ total: verdicts.length, verdicts: verdicts.filter(verdict => !verdict.clean) })
	}

	/** Computes blockers and field losses for an entry based on target capabilities. */
	private verdictFor(entry: Entry): MigrationVerdict {
		const capabilities = this.targetIntegration.capabilitiesFor(this.target)
		const blockers = new Array<MigrationBlocker>()
		const losses = new Array<MigrationLoss>()

		if (entry.recurrenceId || (entry.id && this.overriddenMasterIds.has(entry.id))) {
			blockers.push('occurrence')
		}
		if (entry.recurrence?.freq && !capabilities.recurrence) {
			blockers.push('recurrence')
		}
		if (entry.participants?.length && !capabilities.participants) {
			blockers.push('participants')
		}
		// Only 'Free' transparency is a blocker; default opaque is preserved implicitly.
		if (entry.transparency === Transparency.Free && !capabilities.transparency) {
			blockers.push('transparency')
		}
		if (entry.visibility && !capabilities.visibility) {
			blockers.push('visibility')
		}
		if (entry.percentComplete !== null && entry.percentComplete !== undefined && !capabilities.percentComplete) {
			blockers.push('percentComplete')
		}

		if (entry.reminders?.length && !capabilities.reminders) {
			losses.push('reminders')
		}
		if (entry.location && !capabilities.location) {
			losses.push('location')
		}
		if (entry.description && !capabilities.description) {
			losses.push('description')
		}
		// Floating time zone is not a named zone, so it has no zone loss.
		if (entry.timeZone && entry.timeZone !== FLOATING_TIME_ZONE && !capabilities.timeZone) {
			losses.push('timeZone')
		}
		if (entry.allDay && !capabilities.allDay) {
			losses.push('allDay')
		}
		if (entry.status === TaskStatus.Cancelled && !capabilities.cancelledStatus) {
			losses.push('cancelledStatus')
		}
		if (!this.target.supportsEntryType(entry.type)) {
			losses.push('type')
		}

		return new MigrationVerdict({
			entryId: entry.id!,
			heading: entry.heading,
			blockers,
			losses,
			occurrences: !blockers.includes('recurrence') ? null : this.occurrencesOf(entry)?.length ?? null,
		})
	}

	/** Occurrences within FLATTEN_HORIZON_DAYS, respecting exclusions. */
	private occurrencesOf(master: Entry): Array<{ start: Date, end: Date }> | undefined {
		if (!master.start) {
			return undefined
		}
		const from = master.start as Date
		const until = new Date(Math.max(Date.now(), from.getTime()) + FLATTEN_HORIZON_DAYS * 24 * 60 * 60 * 1000)
		return Occurrences.of(master)?.within(from, until)
	}

	/** Runs migration holding exclusive locks across both integrations. */
	run(): Promise<MigrationOutcome> {
		return Integration.exclusivelyAcross([this.originIntegration.id, this.targetIntegration.id], () => this.runExclusively())
	}

	private async runExclusively(): Promise<MigrationOutcome> {
		const assessed = this.entries.map(entry => ({ entry, verdict: this.verdictFor(entry) }))
		const taking = assessed.filter(({ verdict }) => verdict.moves(this.flatten))
		const left = assessed.length - taking.length

		// Snapshot relations before move so targetUid can be repointed in phase 2.
		await EntryRelation.loadFor(this.em, taking.map(({ entry }) => entry))

		const copied = new Array<{ original: Entry, copies: Array<Entry> }>()
		const uids = new Map<string, string>()

		// --- Phase 1: copy ------------------------------------------------------------------------
		for (const { entry, verdict } of taking) {
			try {
				const copies = new Array<Entry>()
				for (const copy of this.copiesOf(entry, verdict)) {
					const created = await this.targetIntegration.createEntry(this.em, copy)
					await EntryRelation.reconcile(this.em, created.id!, created.relations ?? null)
					// Record old -> new UID mappings for target-minted identities on move, and fresh UIDs on copy.
					if (entry.uid && created.uid && created.uid !== entry.uid && !verdict.flattenable) {
						uids.set(entry.uid, created.uid)
					}
					copies.push(created)
				}
				copied.push({ original: entry, copies })
			} catch (error) {
				return this.rollBack(copied, entry, error, left)
			}
		}

		try {
			await this.em.flush()
		} catch (error) {
			return this.rollBack(copied, undefined, error, left)
		}

		// --- Phase 2: repoint ---------------------------------------------------------------------
		// Moves rewrite all matching target references; copies scope repointing to the copied set.
		if (uids.size) {
			const copyIds = copied.flatMap(({ copies }) => copies.map(copy => copy.id!))
			const scope = { targetUid: { $in: [...uids.keys()] }, ...this.keepOriginals ? { entryId: { $in: copyIds } } : {} }
			for (const row of await this.em.find(EntryRelation, scope)) {
				row.targetUid = uids.get(row.targetUid)!
			}
			await this.em.flush()
		}

		// --- Phase 3: delete ----------------------------------------------------------------------
		const outcome = new MigrationOutcome({ left, created: copied.reduce((total, { copies }) => total + copies.length, 0) })
		if (!this.keepOriginals) {
			for (const { original } of copied) {
				try {
					await this.originIntegration.deleteEntry(this.em, original)
					outcome.moved++
				} catch (error) {
					outcome.duplicates++
					logger.error(`Copied "${original.heading}" (${original.id}) into ${this.target} but could not delete the original: ${SourceMigration.messageOf(error)}`)
				}
			}
			await this.em.flush()
		}
		logger.info(`${this.keepOriginals ? 'Copied' : 'Moved'} ${outcome.created} entries from ${this.origin} to ${this.target} — ${outcome.left} left behind, ${outcome.duplicates} duplicated`)
		return outcome
	}

	/** Reverts created copies on abort before originals are touched. */
	private async rollBack(copied: ReadonlyArray<{ original: Entry, copies: Array<Entry> }>, failed: Entry | undefined, error: unknown, left: number): Promise<MigrationOutcome> {
		const outcome = new MigrationOutcome({
			left: left + copied.length + (failed ? 1 : 0),
			failure: SourceMigration.messageOf(error),
			failedEntry: failed?.heading ?? null,
		})
		for (const { copies } of copied) {
			for (const copy of copies) {
				await this.targetIntegration.deleteEntry(this.em, copy).catch(() => outcome.duplicates++)
			}
		}
		await this.em.flush().catch(() => void 0)
		logger.error(`Migration from ${this.origin} to ${this.target} aborted at "${failed?.heading ?? ''}" — ${outcome.duplicates} copies could not be taken back: ${outcome.failure}`)
		return outcome
	}

	/** Creates entry copies in target; expands series if flatten is true. */
	private copiesOf(entry: Entry, verdict: MigrationVerdict): Array<Entry> {
		if (!this.flatten || !verdict.flattenable) {
			return [this.copyOf(entry)]
		}
		return (this.occurrencesOf(entry) ?? []).map(occurrence => this.copyOf(entry, {
			uid: crypto.randomUUID(),
			recurrence: null,
			exdates: undefined,
			start: occurrence.start as DateTime,
			end: entry.end ? occurrence.end as DateTime : undefined,
		}))
	}

	/** Creates a target entry clone, preserving content and UID (or minting fresh UID for copy), dropping origin sync data. */
	private copyOf(entry: Entry, overrides: Partial<Entry> = {}): Entry {
		const copy = new Entry({
			id: crypto.randomUUID(),
			uid: this.keepOriginals ? crypto.randomUUID() : entry.uid,
			sourceId: this.target.id,
			type: entry.type,
			heading: entry.heading,
			description: entry.description,
			location: entry.location,
			color: entry.color ?? null,
			start: entry.start,
			end: entry.end,
			allDay: entry.allDay,
			timeZone: entry.timeZone,
			status: entry.status,
			percentComplete: entry.percentComplete,
			transparency: entry.transparency,
			visibility: entry.visibility,
			recurrence: entry.recurrence,
			exdates: entry.recurrence?.freq ? exdatesOf(entry) : undefined,
			reminders: entry.reminders ? [...entry.reminders] : entry.reminders,
			participants: entry.participants,
			relations: entry.relations ?? null,
			...overrides,
		})
		copy.migrateTo(this.target)
		return copy
	}

	private static messageOf(error: unknown) {
		return error instanceof Error ? error.message : String(error)
	}
}
