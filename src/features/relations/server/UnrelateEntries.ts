import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { validation } from '../../../infrastructure/validation/validation.js'
import { operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { tool } from '../../agents/server/tool.js'
import { EntryPatch } from '../../entries/EntryPatch.js'
import { EntryRelation } from '../EntryRelation.js'
import { EntryRelations } from '../EntryRelations.js'
import { attachRelations } from './relations.js'

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
		const existing = await user.entry(em, id)
		const other = await user.entry(em, target)
		await EntryRelation.loadFor(em, [existing])
		const calendar = await user.calendar(em, existing.sourceId)

		const change = existing.edit(new EntryPatch())
		change.edited.unrelate({ type, targetUid: other.uid })
		const relations = change.edited.relations ?? EntryRelations.none
		const errors = [...Object.assign(new EntryPatch(), { relations }).validate({ entry: existing, to: calendar })]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		const saved = await change.save(em, calendar, calendar)
		await EntryRelation.reconcile(em, saved.id!, relations)
		await em.flush()
		await attachRelations(em, user, [saved])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Unrelated entry ${saved.id} from ${other.id} (${type})`)
		return saved
	}
}
