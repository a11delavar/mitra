import { type EntityManager } from '@mikro-orm/core'
import { Entry } from '#features/entries'
import { Source } from '#features/sources'
import { Backfill } from '#infrastructure/database/Backfill.js'
import { RoutineRecognition } from './RoutineRecognition.js'

/** Places the entries stored before routines were kept, as every entry written since is placed, a calendar at a time. */
export class RecognizeStoredEntries extends Backfill {
	readonly name = 'recognize-stored-entries'

	async run(em: EntityManager) {
		for (const { id } of await em.find(Source, {})) {
			await RoutineRecognition.of(em).place(await em.find(Entry, { sourceId: id, routineId: null }))
			await em.flush()
			em.clear()
		}
	}
}
