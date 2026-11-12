import { FlushMode, type EventSubscriber } from '@mikro-orm/core'
import { Entry } from '#features/entries'
import { Recurrence } from '#features/recurrence'
import { Routine } from '../Routine.js'
import { RoutineRecognition } from './RoutineRecognition.js'

const recurrenceMapper = new Recurrence.Mapper()

/**
 * Places the entries a flush writes in their routines before it writes them, whichever path wrote them. Registered in the
 * ORM config. Only new entries and those whose title, calendar, rule or routine changed: a sync's flush holds every entry
 * of its calendars, and passing over the rest keeps an idle cycle as cheap as before.
 */
export const RoutineSubscriber: EventSubscriber = {
	async beforeFlush({ em, uow }) {
		const removed = uow.getRemoveStack()
		const original = (entry: Entry, property: string, column: string) => {
			const data = uow.getOriginalEntityData(entry) as Record<string, unknown> | undefined
			return data && (data[property] ?? data[column] ?? undefined)
		}
		const moved = (entry: Entry) => !uow.getOriginalEntityData(entry) || original(entry, 'sourceId', 'source_id') !== entry.sourceId
		const changed = (entry: Entry) => moved(entry)
			|| original(entry, 'heading', 'heading') !== entry.heading
			|| original(entry, 'routineId', 'routine_id') !== entry.routineId
			|| !!original(entry, 'routineDeclined', 'routine_declined') !== !!entry.routineDeclined
			|| (original(entry, 'recurrence', 'recurrence') ?? null) !== recurrenceMapper.convertToDatabaseValue(entry.recurrence)
		const written = [...new Set([...uow.getPersistStack(), ...uow.getIdentityMap()])]
			.filter((entity): entity is Entry => entity instanceof Entry && !removed.has(entity) && changed(entity))

		// A routine follows a member to the calendar it moves to. A query inside a flush must not flush again.
		for (const entry of written.filter(entry => entry.routineId && moved(entry))) {
			const routine = await em.findOne(Routine, { id: entry.routineId }, { flushMode: FlushMode.COMMIT })
			if (routine && routine.sourceId !== entry.sourceId) {
				routine.sourceId = entry.sourceId
			}
		}
		await RoutineRecognition.of(em).place(written, removed)
	},
}
