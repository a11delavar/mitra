import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { EntryRank } from '../EntryRank.js'

@operation()
@label('Rank tasks')
@description('Stores where tasks stand in the manual order, as their ranks keyed by entry id. Only one-off tasks have a place of their own.')
@http({ method: 'PUT', path: '/entries/ranks' })
export class RankTasks extends Operation<Readonly<Record<string, unknown>>, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const keys = Object.entries(this.parameters)
		if (!keys.length || keys.some(([, key]) => typeof key !== 'string')) {
			throw new ValidationError('Ranks must map entry ids to rank keys')
		}
		let ranks: Array<[string, EntryRank]>
		try {
			ranks = keys.map(([id, key]) => [id, EntryRank.parse(key as string)])
		} catch {
			throw new ValidationError('Malformed rank')
		}
		for (const [id, rank] of ranks) {
			const entry = await user.entry(em, id)
			if (!entry.type.isTask || entry.recurringEntryId) {
				throw new ValidationError('Only tasks have a manual order')
			}
			entry.rank = rank
		}
		await em.flush()
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Ranked ${ranks.length} task(s)`)
	}
}
