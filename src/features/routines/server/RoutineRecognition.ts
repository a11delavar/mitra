import { FlushMode, type EntityManager } from '@mikro-orm/core'
import { Entry } from '#features/entries'
import { Source } from '#features/sources'
import { User } from '#features/identity'
import { TimeZone } from '#features/time/TimeZone.js'
import { Integration } from '#integrations'
import { Routine } from '../Routine.js'
import { RoutineCadence } from '../RoutineCadence.js'

/**
 * Finds the routines entries belong to, once: an entry in a routine stays in it whatever becomes of it, so only those in
 * none are placed, by three rules in this order.
 *
 * 1. An entry joins the routine whose members wear its title in its calendar ({@link join}).
 * 2. Entries no routine took found one with those sharing their title, where together they are a routine ({@link found}).
 * 3. An override goes with its recurring entry, whatever its own title ({@link follow}).
 *
 * Calendars that can only be read are left alone: what another keeps is not gathered into routines unasked.
 */
export class RoutineRecognition {
	/** The fewest dates a routine is founded on. */
	static readonly floor = 4

	static of(em: EntityManager) {
		return new RoutineRecognition(em)
	}

	/**
	 * Whether entries sharing a title are a routine: with four dates between them, where one repeats, however rarely, or
	 * where they are entries of their own that come often enough to collapse in the year view, or keep their cadence.
	 */
	static founds(entries: ReadonlyArray<Entry>, zone: TimeZone) {
		if (entries.reduce((dates, entry) => dates + entry.occurrences.count, 0) < RoutineRecognition.floor) {
			return false
		}
		if (entries.some(entry => entry.recurrence?.freq)) {
			return true
		}
		const days = entries.flatMap(entry => entry.occurrences.single.dayIn(zone) ?? [])
		const cadence = RoutineCadence.between(days)
		return !!cadence && (cadence.collapsesIn('month') || cadence.keptBy(days))
	}

	/** Whether an entry may still be placed: in no routine, not taken out of them all, and no availability. */
	private static open(entry: Entry) {
		return !entry.routineId && !entry.routineDeclined && !entry.type?.isAvailability
	}

	/** What tells the entries of one routine together: their calendar and the title they wear. */
	private static wearing(sourceId: string, title: string) {
		return `${sourceId}\n${title}`
	}

	/** Those an entry would found a routine with: the ones wearing its title in its calendar, or itself alone where it repeats untitled. */
	private static poolOf(entry: Entry) {
		const title = Routine.titleOf(entry.heading)
		return title ? RoutineRecognition.wearing(entry.sourceId, title) : entry.recurrence?.freq ? entry.id : undefined
	}

	private constructor(private readonly em: EntityManager) { }

	/** Places those of `written` still in no routine, and the stored entries a routine founded here takes in. `removed` are leaving with this flush. */
	async place(written: ReadonlyArray<Entry>, removed: ReadonlySet<unknown> = new Set()) {
		const zones = await this.homeZonesOf(written.filter(RoutineRecognition.open).map(entry => entry.sourceId))
		const pending = written.filter(entry => RoutineRecognition.open(entry) && zones.has(entry.sourceId))
		if (!pending.length) {
			return
		}
		const entries = pending.filter(entry => !entry.recurringEntryId)
		const joined = await this.join(entries, written)
		const founders = await this.found(entries.filter(entry => !entry.routineId), zones, removed)
		await this.follow(pending.filter(entry => entry.recurringEntryId), [...joined, ...founders], written, removed)
	}

	/** Rule 1. A dissolved routine takes entries in as any other, which keeps them out of sight. Answers those that joined. */
	private async join(entries: ReadonlyArray<Entry>, written: ReadonlyArray<Entry>) {
		const routines = await this.routinesWearing([...new Set(entries.map(entry => entry.sourceId))], written)
		const joined = new Array<Entry>()
		for (const entry of entries) {
			const title = Routine.titleOf(entry.heading)
			const routineId = title && routines.get(RoutineRecognition.wearing(entry.sourceId, title))
			if (routineId) {
				entry.routineId = routineId
				joined.push(entry)
			}
		}
		return joined
	}

	/** Rule 2. The stored entries sharing a title are counted with those written, and go into the routine with them. Answers the founders. */
	private async found(entries: ReadonlyArray<Entry>, zones: ReadonlyMap<string, TimeZone>, removed: ReadonlySet<unknown>) {
		const pooled = entries.filter(entry => RoutineRecognition.poolOf(entry))
		const stored = await this.storedSharingTitlesWith(pooled)
		const founders = new Array<Entry>()
		for (const [pool, own] of Map.groupBy(pooled, entry => RoutineRecognition.poolOf(entry)!)) {
			// As they are now: a stored one this flush renames or removes shares the title no more.
			const sharing = [...new Set([...own, ...stored.get(pool) ?? []])]
				.filter(entry => RoutineRecognition.open(entry) && !entry.recurringEntryId && !removed.has(entry) && RoutineRecognition.poolOf(entry) === pool)
			const { sourceId } = own[0]!
			if (RoutineRecognition.founds(sharing, zones.get(sourceId)!)) {
				const routine = new Routine({ sourceId })
				this.em.persist(routine)
				for (const entry of sharing) {
					entry.routineId = routine.id
				}
				founders.push(...sharing)
			}
		}
		return founders
	}

	/** Rule 3, for the overrides written, and for the stored ones of a recurring entry `placed` just now. */
	private async follow(overrides: ReadonlyArray<Entry>, placed: ReadonlyArray<Entry>, written: ReadonlyArray<Entry>, removed: ReadonlySet<unknown>) {
		const known = new Map([...written, ...placed].flatMap(entry => entry.id ? [[entry.id, entry] as const] : []))
		for (const override of overrides) {
			const recurringEntry = known.get(override.recurringEntryId!) ?? await this.em.findOne(Entry, { id: override.recurringEntryId }, this.reading)
			override.routineId = recurringEntry?.routineId
		}
		const repeating = placed.filter(entry => entry.recurrence?.freq && entry.id)
		const stored = !repeating.length ? [] : await this.em.find(Entry, { recurringEntryId: { $in: repeating.map(entry => entry.id!) }, routineId: null, routineDeclined: null }, this.reading)
		for (const override of stored.filter(override => !removed.has(override))) {
			override.routineId = known.get(override.recurringEntryId!)?.routineId
		}
	}

	// A query inside a flush must not flush again, and the ORM writes into the options it is given.
	private get reading() {
		return { flushMode: FlushMode.COMMIT }
	}

	private rows<T>(sql: string, parameters: ReadonlyArray<unknown>) {
		return this.em.getConnection().execute(sql, [...parameters], 'all', this.em.getTransactionContext()) as Promise<Array<T>>
	}

	private static listOf(values: ReadonlyArray<unknown>) {
		return values.map(() => '?').join(', ')
	}

	/** The zone each calendar's person is at home in, whose days its entries fall on. Only of calendars that are recognized. */
	private async homeZonesOf(sourceIds: ReadonlyArray<string>) {
		const zones = new Map<string, TimeZone>()
		for (const sourceId of new Set(sourceIds)) {
			const source = await this.em.findOne(Source, { id: sourceId }, this.reading)
			const integration = !source || source.readOnly ? undefined : await this.em.findOne(Integration, { id: source.integrationId }, this.reading)
			const user = integration && await this.em.findOne(User, { id: integration.userId }, this.reading)
			if (user) {
				zones.set(sourceId, user.timeZones?.home?.zone ?? TimeZone.default)
			}
		}
		return zones
	}

	/**
	 * The routine wearing each title in these calendars, the one its latest member names where two do. The stored members
	 * are asked for their headings alone, compared here, as the database folds the case of ASCII only; those `written`
	 * wear what they do now.
	 */
	private async routinesWearing(sourceIds: ReadonlyArray<string>, written: ReadonlyArray<Entry>) {
		const stored = !sourceIds.length ? [] : await this.rows<{ source_id: string, heading: string | null, routine_id: string, latest: number | null }>(
			`select source_id, heading, routine_id, max(coalesce(start, due)) as latest from entry where source_id in (${RoutineRecognition.listOf(sourceIds)}) and routine_id is not null group by source_id, heading, routine_id`,
			sourceIds,
		)
		const wearers = [
			...stored.map(row => ({ sourceId: row.source_id, title: Routine.titleOf(row.heading), routineId: row.routine_id, latest: row.latest ?? -Infinity })),
			...written.filter(entry => entry.routineId).map(entry => ({ sourceId: entry.sourceId, title: Routine.titleOf(entry.heading), routineId: entry.routineId!, latest: (entry.start ?? entry.due)?.getTime() ?? -Infinity })),
		].sort((a, b) => a.latest - b.latest)
		return new Map(wearers.flatMap(({ sourceId, title, routineId }) => title ? [[RoutineRecognition.wearing(sourceId, title), routineId] as const] : []))
	}

	/**
	 * The stored entries in no routine that share a title with one of `entries`, by their pool. Found by the spellings
	 * of that title the calendar holds, compared here, and only those entries are then read.
	 */
	private async storedSharingTitlesWith(entries: ReadonlyArray<Entry>) {
		const titled = entries.filter(entry => Routine.titleOf(entry.heading))
		const wanted = new Set(titled.map(entry => RoutineRecognition.poolOf(entry)))
		const sourceIds = [...new Set(titled.map(entry => entry.sourceId))]
		const spellings = !sourceIds.length ? [] : await this.rows<{ source_id: string, heading: string }>(
			`select distinct source_id, heading from entry where source_id in (${RoutineRecognition.listOf(sourceIds)}) and routine_id is null and routine_declined is null and recurring_entry_id is null and heading is not null`,
			sourceIds,
		)
		const sharing = new Array<Entry>()
		const shared = spellings.filter(({ source_id, heading }) => wanted.has(RoutineRecognition.wearing(source_id, Routine.titleOf(heading) ?? '')))
		for (const [sourceId, rows] of Map.groupBy(shared, row => row.source_id)) {
			// In portions, as a statement takes only so many values.
			for (let index = 0; index < rows.length; index += 500) {
				const headings = rows.slice(index, index + 500).map(row => row.heading)
				sharing.push(...await this.em.find(Entry, { sourceId, heading: { $in: headings }, routineId: null, routineDeclined: null, recurringEntryId: null }, this.reading))
			}
		}
		return Map.groupBy(sharing, entry => RoutineRecognition.poolOf(entry))
	}
}
