import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { tool } from '#features/agents/server/tool.js'
import { EntryPatch } from '#features/entries'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { validation } from '#infrastructure/validation'
import { operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { EntryRelations } from '../EntryRelations.js'

class Parameters {
	@validation(z.string())
	@description('The entry\'s id, the one the relation is its own.')
	readonly id!: string

	@validation(z.string())
	@description('The relation\'s type, as the entry lists it (FINISHTOSTART, PARENT).')
	readonly type!: string

	@validation(z.string())
	@description('The other entry\'s id.')
	readonly target!: string
}

@operation(Parameters)
@label('Unrelate two entries')
@description('Removes one relation of an entry to another, leaving its other relations as they are. A relation that is not there changes nothing.')
@tool({ name: 'unrelate_entries', annotations: { idempotentHint: true } })
export class UnrelateEntries extends Operation<Parameters> {
	async run({ em, user }: OperationContext) {
		const { id, type, target } = this.parameters
		const existing = await user.getEntry(em, id)
		const other = await user.getEntry(em, target)

		const change = existing.edit(Object.assign(new EntryPatch(), { relations: (existing.relations ?? EntryRelations.none).without({ type, targetUid: other.uid }) }))
		const errors = [...change.validate({ graph: await user.getRelationGraph(em, change.patch.relations) })]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		const saved = await change.save(em)
		await em.flush()
		const graph = await user.getRelationGraph(em)
		graph.attach([saved])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Unrelated entry ${saved.id} from ${other.id} (${type})`)
		return saved
	}
}
