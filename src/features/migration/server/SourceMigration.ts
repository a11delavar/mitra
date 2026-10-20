import { DateTimeRange } from '@3mo/date-time'
import { description } from '@a11d/metadata'
import { z } from 'zod'
import { type EntityManager } from '@mikro-orm/core'
import type { User } from '#features/identity'
import { Entry } from '#features/entries'
import { EntryRelation, EntryRelations } from '#features/relations'
import type { Source } from '#features/sources'
import { Integration } from '#integrations'
import { validation, ValidationError } from '#infrastructure/validation'
import { createLogger } from '#infrastructure/logging/Logger.js'
import { MigrationOutcome, MigrationPlan, MigrationVerdict } from '../MigrationPlan.js'

const logger = createLogger('Migration')

const FLATTEN_HORIZON_DAYS = 366

/** Migration request cannot be fulfilled (e.g. invalid target or origin). */
export class MigrationRefused extends ValidationError { }

/** Moves or copies entries in three phases: copy into the target, repoint `EntryRelation.targetUid`, delete the originals. */
/** What moving a calendar's entries asks: where they go, which of them, and whether the originals stay. */
export class MigrationOptions {
	@validation(z.string().min(1, 'A target calendar is required'))
	@description('The calendar the entries go to.')
	readonly targetSourceId!: string

	@validation(z.array(z.string()).optional())
	@description('The entries to move, by id; none moves them all.')
	readonly entryIds?: ReadonlyArray<string>

	@validation(z.boolean().optional())
	@description('Copies rather than moves: the originals stay.')
	readonly keepOriginals?: boolean

	@validation(z.boolean().optional())
	@description('Writes a series the target cannot repeat as its occurrences, rather than leaving it behind.')
	readonly flatten?: boolean
}

export class SourceMigration {
	private constructor(
		private readonly em: EntityManager,
		/** Who moves the entries: only their links are theirs to repoint. */
		private readonly user: User,
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
		if (targetSourceId === originId) {
			throw new MigrationRefused('Entries cannot move to the calendar they are already in')
		}

		// Read-only origins permit copy, but refuse move.
		const [origin, target] = [await user.source(em, originId), await user.source(em, targetSourceId)]
		const [originIntegration, targetIntegration] = await Promise.all([
			em.findOneOrFail(Integration, { id: origin.integrationId }),
			em.findOneOrFail(Integration, { id: target.integrationId }),
		])
		if (!keepOriginals && !originIntegration.capabilitiesFor(origin).entries.delete) {
			throw new MigrationRefused('Entries in this calendar cannot be deleted from mitra, so they can only be copied out of it')
		}
		if (!targetIntegration.capabilitiesFor(target).entries.create) {
			throw new MigrationRefused('This calendar cannot be written to from mitra')
		}

		const ids = entryIds as Array<string> | undefined
		const entries = await em.find(Entry, { sourceId: origin.id, ...ids ? { id: { $in: ids } } : {} })
		if (ids && entries.length !== new Set(ids).size) {
			throw new MigrationRefused('Some of the entries are not in this calendar')
		}

		// Identify masters with edited occurrence overrides to hold them back together.
		const overrides = await em.find(Entry, { sourceId: origin.id, recurringEntryId: { $ne: null } })
		const overriddenMasterIds = new Set(overrides.map(override => override.recurringEntryId!))

		return new SourceMigration(em, user, origin, originIntegration, target, targetIntegration, entries, overriddenMasterIds, keepOriginals, options.flatten === true)
	}

	/** Fidelity preview of what the migration would move, modify, or block. */
	plan(): MigrationPlan {
		const verdicts = this.entries.map(entry => this.verdictFor(entry))
		return new MigrationPlan({ total: verdicts.length, verdicts: verdicts.filter(verdict => !verdict.clean) })
	}

	/** Computes blockers and field losses for an entry based on target capabilities. */
	private verdictFor(entry: Entry): MigrationVerdict {
		return MigrationVerdict.assess(entry, {
			target: this.target,
			capabilities: this.targetIntegration.capabilitiesFor(this.target),
			ownership: this.targetIntegration.ownership,
			occurrence: !!entry.recurrenceId || (!!entry.id && this.overriddenMasterIds.has(entry.id)),
			occurrences: () => this.occurrencesOf(entry)?.length ?? null,
		})
	}

	/** Occurrences within FLATTEN_HORIZON_DAYS, respecting exclusions. */
	private occurrencesOf(master: Entry) {
		if (!master.start || !master.occurrences.recurring) {
			return undefined
		}
		const until = new Date(Math.max(Date.now(), master.start.getTime()) + FLATTEN_HORIZON_DAYS * 24 * 60 * 60 * 1000)
		return master.occurrences.within(new DateTimeRange(master.start, until))
	}

	/** Runs migration holding exclusive locks across both integrations. */
	run() {
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
					await EntryRelation.reconcile(this.em, created.id!, created.relations ?? EntryRelations.none)
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
			const sourceIds = (await this.user.sources(this.em)).map(source => source.id)
			await EntryRelation.repoint(this.em, uids, sourceIds, this.keepOriginals ? copyIds : undefined)
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
		logger.info(`${this.keepOriginals ? 'Copied' : 'Moved'} ${outcome.created} entries from ${this.origin} to ${this.target}, ${outcome.left} left behind, ${outcome.duplicates} duplicated`)
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
		logger.error(`Migration from ${this.origin} to ${this.target} aborted at "${failed?.heading ?? ''}". ${outcome.duplicates} copies could not be taken back: ${outcome.failure}`)
		return outcome
	}

	/** Creates entry copies in target; expands series if flatten is true. */
	private copiesOf(entry: Entry, verdict: MigrationVerdict): Array<Entry> {
		if (!this.flatten || !verdict.flattenable) {
			return [this.copyOf(entry)]
		}
		return (this.occurrencesOf(entry) ?? []).map(({ start, end, due }) =>
			this.copyOf(entry, { uid: crypto.randomUUID(), recurrence: undefined, exdates: undefined, start, end, due }))
	}

	/** A copy of `entry` for the target: its content and uid (a fresh uid where the original stays), without the origin's sync data. */
	private copyOf(entry: Entry, overrides: Partial<Entry> = {}): Entry {
		const copy = Object.assign(entry.copy(), {
			id: crypto.randomUUID(),
			uid: this.keepOriginals ? crypto.randomUUID() : entry.uid,
			// A copy is a new task, so it starts unranked rather than sharing the original's key.
			rank: this.keepOriginals ? undefined : entry.rank,
			exdates: entry.recurrence?.freq ? entry.occurrences.excluded : undefined,
			relations: entry.relations,
		}, overrides)
		// Lost where the target holds none or takes none, rather than kept in Mitra's row its next sync would clear.
		if (!this.targetIntegration.ownership.holds('attachments') || !this.targetIntegration.capabilitiesFor(this.target).entries.attach) {
			copy.attachments = undefined
		}
		copy.migrateTo(this.target)
		return copy
	}

	private static messageOf(error: unknown) {
		return error instanceof Error ? error.message : String(error)
	}
}
