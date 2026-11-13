import { converter } from '@a11d/converter'
import type { EntityManager } from '@mikro-orm/core'
import { Source } from '#features/sources'
import { Recurrence } from '#features/recurrence/Recurrence.js'
import { TimeZone } from '#features/time/TimeZone.js'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { model, Entity, identity, equality, entity, primaryKey, property, manyToOne } from '#infrastructure/model'
import { RoutineCadence } from './RoutineCadence.js'

/**
 * Something kept up: entries of one calendar that belong together, whether they repeat or not. Mitra's own record, never
 * written to a provider. It holds no more than what a person says of it; its members name it (`Entry.routineId`), and what
 * it is called and how often it comes are read off them.
 */
@model('Routine')
// Named, as a bundle renames a class whose name another module's class shares, and the table would follow it.
@entity({ tableName: 'routine' })
export class Routine extends Entity {
	/** The title a routine tells its entries by: a heading in lower case, without the space around it. None for a blank one. */
	static titleOf(heading: string | null | undefined) {
		return heading?.trim().toLowerCase() || undefined
	}

	/**
	 * Tells each of `routines` how often it comes, on the days of `zone` (its members' rules beside the cadence of those
	 * that are entries of their own), and the titles its members wear. An override stands in for a date its rule already
	 * counts. Read off the members' few columns alone: the views ask on every refresh, and building every member into an
	 * entry took ten to twenty times as long.
	 */
	static async measure(em: EntityManager, routines: ReadonlyArray<Routine>, zone: TimeZone) {
		const members = !routines.length ? [] : await em.getConnection().execute(
			`select routine_id, heading, coalesce(start, due) as date, all_day, time_zone, recurrence from entry where recurring_entry_id is null and routine_id in (${routines.map(() => '?').join(', ')}) order by date desc`,
			routines.map(routine => routine.id),
			'all',
			em.getTransactionContext(),
		) as Array<{ routine_id: string, heading: string | null, date: number | null, all_day: number | null, time_zone: string | null, recurrence: string | null }>
		const byRoutine = Map.groupBy(members, member => member.routine_id)
		for (const routine of routines) {
			const own = byRoutine.get(routine.id) ?? []
			const days = own.flatMap(member => member.recurrence || member.date === null ? []
				: (member.all_day || member.time_zone === EntryTimeZone.floating.id ? TimeZone.UTC : zone).dayOf(new Date(member.date)))
			routine.cadence = RoutineCadence.of(own.flatMap(member => member.recurrence ? Recurrence.fromRRule(member.recurrence)?.strideDays ?? [] : []), RoutineCadence.between(days))
			routine.titles = [...new Set(own.flatMap(member => member.heading?.trim() || []))]
		}
	}

	@identity()
	@primaryKey() id: string = crypto.randomUUID()

	/** The calendar it lives in, which it follows a member to. */
	@equality()
	@manyToOne(() => Source, { mapToPk: true, deleteRule: 'cascade' }) sourceId!: string

	/** The person's name for it; without, it is named after its members. */
	@equality()
	@property({ type: 'string', nullable: true }) name?: string

	/** Not a routine, the person said: it keeps its members, and those that join it later, out of sight. */
	@equality()
	@property({ type: 'boolean', nullable: true }) dissolved?: boolean

	/** How often it comes. Told as it is listed (`Routine.measure`), as `titles` are, never stored. */
	@converter(RoutineCadence.converter) cadence?: RoutineCadence

	/** The titles its members wear, the newest first, as they spell them. Told as it is listed, never stored. */
	titles?: ReadonlyArray<string>

	constructor(init?: Partial<Routine>) {
		super()
		Object.assign(this, init)
	}
}
