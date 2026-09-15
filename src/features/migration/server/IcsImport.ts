import { type EntityManager } from '@mikro-orm/core'
import ICAL from 'ical.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { Integration } from '../../../integrations/Integration.js'
import { CalDAV } from '../../../integrations/caldav/CalDAV.js'
import { IcsSyncEngine } from '../../../integrations/ics/server/IcsSyncEngine.js'
import { type User } from '../../identity/User.js'
import { Entry } from '../../entries/Entry.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { exdatesOf } from '../../recurrence/server/occurrences.js'
import { MigrationOutcome, MigrationPlan, MigrationVerdict } from '../MigrationPlan.js'
import { MigrationRefused } from './SourceMigration.js'
import { type Source } from '../../sources/Source.js'

const logger = createLogger('Import')

/** A mis-chosen file must not be read into memory unbounded (mirrors the feed cap). */
const maxIcsBytes = 20 * 1024 * 1024

/** One import candidate: the entry parsed from a UID group, keyed by its identity in the file. */
interface IcsEntity {
	readonly entry: Entry
	readonly fileUid: string
	/** The group carries RECURRENCE-ID overrides the import cannot reproduce. */
	readonly occurrence: boolean
}

/**
 * Imports the VEVENT/VTODO components of one iCalendar file into a target source — the file-origin
 * sibling of {@link SourceMigration}'s copy phase. Copy semantics throughout: fresh identities are
 * minted (re-importing a file duplicates predictably instead of overwriting), in-file RELATED-TO
 * links are repointed onto the minted UIDs, and a failure rolls back everything already created.
 */
export class IcsImport {
	private constructor(
		private readonly em: EntityManager,
		readonly target: Source,
		private readonly targetIntegration: Integration,
		private readonly entities: ReadonlyArray<IcsEntity>,
	) { }

	/** Parses the file and resolves the target, validating permissions and file shape. */
	static async of(em: EntityManager, user: User, targetId: string, ics: unknown): Promise<IcsImport> {
		if (typeof ics !== 'string' || !ics.trim()) {
			throw new MigrationRefused('A calendar file is required')
		}
		if (ics.length > maxIcsBytes) {
			throw new MigrationRefused('The file is too large to import')
		}
		const target = await user.source(em, targetId)
		const integration = await em.findOneOrFail(Integration, { id: target.integrationId })
		if (!integration.capabilitiesFor(target).createEntries) {
			throw new MigrationRefused('This calendar cannot be written to from mitra')
		}

		let calendar: ICAL.Component
		try {
			calendar = new ICAL.Component(ICAL.parse(ics))
		} catch {
			throw new MigrationRefused('The file is not a readable calendar (.ics) file')
		}
		const timezones = calendar.getAllSubcomponents('vtimezone')

		// Group master and occurrence overrides by UID, like the feed engine does.
		const groups = Map.groupBy(IcsSyncEngine.modelledComponents(calendar),
			component => component.getFirstPropertyValue('uid')?.toString() || IcsSyncEngine.syntheticUid(component))

		const entities = [...groups].map(([fileUid, components]): IcsEntity => {
			const master = components.find(component => !CalDAV.recurrenceProps(component).recurrenceId) ?? components[0]!
			const entry = new Entry({ id: crypto.randomUUID(), sourceId: target.id })
			CalDAV.applyComponent(entry, master, integration)
			entry.uid = crypto.randomUUID()
			if (entry.recurrence?.freq) {
				// EXDATEs travel through the exdates column; the parse reads them off a transient raw
				// (the same authority the expansion reads) which must not persist — the file is not sync state.
				entry.data = { raw: IcsSyncEngine.serialize([master], timezones) }
				const exdates = exdatesOf(entry)
				entry.exdates = exdates.length ? exdates : undefined
				entry.data = undefined
			}
			return { entry, fileUid, occurrence: components.some(component => !!CalDAV.recurrenceProps(component).recurrenceId) }
		})
		if (!entities.length) {
			throw new MigrationRefused('The file contains no events or tasks')
		}

		return new IcsImport(em, target, integration, entities)
	}

	/** Fidelity preview of what the import would add, modify, or leave out. */
	plan(): MigrationPlan {
		const verdicts = this.entities.map(entity => this.verdictFor(entity))
		return new MigrationPlan({ total: verdicts.length, verdicts: verdicts.filter(verdict => !verdict.clean) })
	}

	private verdictFor({ entry, occurrence }: IcsEntity): MigrationVerdict {
		return MigrationVerdict.assess(entry, {
			target: this.target,
			capabilities: this.targetIntegration.capabilitiesFor(this.target),
			occurrence,
		})
	}

	/** Runs the import holding the target integration's exclusive lock. */
	run(): Promise<MigrationOutcome> {
		return Integration.exclusively(this.targetIntegration.id, () => this.runExclusively())
	}

	private async runExclusively(): Promise<MigrationOutcome> {
		const taking = this.entities.filter(entity => this.verdictFor(entity).moves(false))
		const left = this.entities.length - taking.length

		const created = new Array<Entry>()
		const uids = new Map<string, string>()

		for (const { entry, fileUid } of taking) {
			try {
				// Converted only now — the verdicts above must judge the type the file authored.
				entry.migrateTo(this.target)
				const row = await this.targetIntegration.createEntry(this.em, entry)
				await EntryRelation.reconcile(this.em, row.id!, row.relations ?? null)
				if (row.uid) {
					uids.set(fileUid, row.uid)
				}
				created.push(row)
			} catch (error) {
				return this.rollBack(created, entry, error)
			}
		}

		try {
			await this.em.flush()
		} catch (error) {
			return this.rollBack(created, undefined, error)
		}

		// Repoint in-file links onto the minted identities; links to UIDs outside the file are left alone.
		if (uids.size) {
			const scope = { targetUid: { $in: [...uids.keys()] }, entryId: { $in: created.map(row => row.id!) } }
			for (const row of await this.em.find(EntryRelation, scope)) {
				row.targetUid = uids.get(row.targetUid)!
			}
			await this.em.flush()
		}

		logger.info(`Imported ${created.length} entries from a calendar file into ${this.target} — ${left} left out`)
		return new MigrationOutcome({ created: created.length, left })
	}

	/** Reverts created entries on abort so a partial file never lands. */
	private async rollBack(created: ReadonlyArray<Entry>, failed: Entry | undefined, error: unknown): Promise<MigrationOutcome> {
		const outcome = new MigrationOutcome({
			left: this.entities.length,
			failure: error instanceof Error ? error.message : String(error),
			failedEntry: failed?.heading ?? null,
		})
		for (const row of created) {
			await this.targetIntegration.deleteEntry(this.em, row).catch(() => outcome.duplicates++)
		}
		await this.em.flush().catch(() => void 0)
		logger.error(`Import into ${this.target} aborted at "${failed?.heading ?? ''}" — ${outcome.duplicates} entries could not be taken back: ${outcome.failure}`)
		return outcome
	}
}
