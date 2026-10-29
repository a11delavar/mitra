import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { tool } from '#features/agents/server/tool.js'
import { EntryPatch } from '#features/entries'
import { validation } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { EntryRelations } from '../EntryRelations.js'
import { RelationType } from '../RelationType.js'

class Parameters {
	@validation(z.string())
	@description('The entry\'s id, the one the relation is its own.')
	readonly id!: string

	@validation(z.enum(RelationType.authorable.map(type => type.value)))
	@description('FINISHTOSTART when the entry cannot start until the other finishes; PARENT when it is a subtask of the other.')
	readonly type!: string

	@validation(z.string())
	@description('The other entry\'s id.')
	readonly target!: string
}

@operation(Parameters)
@label('Relate two entries')
@description('Relates an entry to another, leaving its other relations as they are: a dependency, or a subtask under its parent. Relating twice changes nothing.')
@tool({ name: 'relate_entries', annotations: { idempotentHint: true } })
@updates('entries')
export class RelateEntries extends Operation<Parameters> {
	async run({ em, user }: OperationContext) {
		const { id, type, target } = this.parameters
		const existing = await user.getEntry(em, id)
		const other = await user.getEntry(em, target)

		const change = existing.edit(Object.assign(new EntryPatch(), { relations: (existing.relations ?? EntryRelations.none).adding(type, other.uid!) }))
		const errors = [...change.validate({ graph: await user.getRelationGraph(em, change.related) })]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		const saved = await change.save(em)
		await em.flush()
		const graph = await user.getRelationGraph(em, [saved.uid])
		graph.attach([saved])
		this.logger.debug(`Related entry ${saved.id} to ${other.id} (${type})`)
		return saved
	}
}
