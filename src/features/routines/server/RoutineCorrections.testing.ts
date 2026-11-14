import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, EntryPatch } from '#features/entries'
import { Recurrence, RecurrenceFrequency } from '#features/recurrence'
import { CreateEntry } from '#features/entries/server/CreateEntry.js'
import type { OperationServer } from '#infrastructure/operations/OperationServer.testing.js'

/** The routine an entry belongs to, as stored. */
export async function routineOf(server: OperationServer, entryId: string) {
	return (await server.query<{ routine_id: string | null }>('select routine_id from entry where id = ?', [entryId]))[0]?.routine_id ?? undefined
}

/** A routine as stored. */
export async function routine(server: OperationServer, id: string | undefined) {
	return (await server.query<{ source_id: string, name: string | null, dissolved: number | null }>('select source_id, name, dissolved from routine where id = ?', [id]))[0]
}

/** A daily recurring event in `sourceId`, which founds a routine: its id and its routine's. */
export async function dailyRoutine(server: OperationServer, heading: string, sourceId = server.source.id) {
	const start = new DateTime('2026-09-01T06:00:00.000Z')
	const { id } = await CreateEntry.call(EntryPatch.creating(new Entry({ sourceId, type: EntryType.Event, heading, start, end: start.add({ minutes: 30 }), recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })))
	return { id: id!, routineId: (await routineOf(server, id!))! }
}
