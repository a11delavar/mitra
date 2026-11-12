import { RecognizeStoredEntries } from '#features/routines/server/RecognizeStoredEntries.js'
import { type Backfill } from './Backfill.js'

/** Every backfill a migration may ask for. */
export const backfills: ReadonlyArray<Backfill> = [
	new RecognizeStoredEntries(),
]
