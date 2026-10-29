import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { ValidationError, validation } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { EntryRank } from '../EntryRank.js'

function rankOf(key: string) {
	try {
		return EntryRank.parse(key)
	} catch {
		throw new ValidationError('Malformed rank', ['ranks'])
	}
}

class Parameters {
	@validation(z.array(z.tuple([z.string(), z.custom<EntryRank>(value => value instanceof EntryRank)])).min(1, 'Ranks must map entry ids to rank keys'))
	@description('Each task\'s rank key in the manual order, by its entry id.')
	@converter({
		schema: z.record(z.string(), z.string()),
		construct: (written: Record<string, string>) => Object.entries(written).map(([id, key]) => [id, rankOf(key)] as const),
		deconstruct: (ranks: ReadonlyArray<readonly [string, EntryRank]>) => Object.fromEntries(ranks.map(([id, rank]) => [id, rank.key])),
	}) readonly ranks!: ReadonlyArray<readonly [string, EntryRank]>
}

@operation(Parameters)
@label('Rank tasks')
@description('Stores where tasks stand in the manual order, as their ranks keyed by entry id. Only one-off tasks have a place of their own.')
@http({ method: 'PUT', path: '/entries/ranks' })
@updates('entries')
export class RankTasks extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const { ranks } = this.parameters
		for (const [id, rank] of ranks) {
			const entry = await user.getEntry(em, id)
			if (!entry.type.isTask || entry.recurringEntryId) {
				throw new ValidationError('Only tasks have a manual order')
			}
			entry.rank = rank
		}
		await em.flush()
		this.logger.debug(`Ranked ${ranks.length} task(s)`)
	}
}
