import type { Routine } from '../Routine.js'

/** The routines as the server last listed them, by id. */
export class RoutineStore {
	static routines: ReadonlyMap<string, Routine> = new Map()

	static apply(routines: ReadonlyArray<Routine>) {
		RoutineStore.routines = new Map(routines.map(routine => [routine.id, routine]))
	}
}
