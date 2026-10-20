import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { tool } from '#features/agents/server/tool.js'
import { EntryPatch } from '#features/entries'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { validation } from '#infrastructure/validation'
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
export class RelateEntries extends Operation<Parameters> {
	async run({ em, user }: OperationContext) {
		const { id, type, target } = this.parameters
		const existing = await user.entry(em, id)
		const other = await user.entry(em, target)
		const calendar = await user.calendar(em, existing.sourceId)

		const change = existing.edit(new EntryPatch())
		change.edited.relateTo(type, other.uid!)
		const relations = change.edited.relations ?? EntryRelations.none
		const errors = [...Object.assign(new EntryPatch(), { relations }).validate({ entry: existing, to: calendar }), ...change.edited.validate(calendar), ...relations.validate({ entry: existing, graph: await user.relationGraph(em, relations) })]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		const saved = await change.save(em, calendar, calendar)
		await em.flush()
		const graph = await user.relationGraph(em)
		graph.attach([saved])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Related entry ${saved.id} to ${other.id} (${type})`)
		return saved
	}
}
