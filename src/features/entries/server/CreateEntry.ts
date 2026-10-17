import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { EntryRelations } from '../../relations/EntryRelations.js'
import { assertRelationsValid, attachRelations } from '../../relations/server/relations.js'
import { fileStore } from '../../files/server/FileStore.js'
import { Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'

@operation()
@label('Create an entry')
@description('Creates an event or a task in a calendar. A task without a start is unscheduled and waits in the planning list.')
@http({ method: 'POST', path: '/entries', status: 201 })
export class CreateEntry extends Operation<EntryPatch, Entry> {
	static override fromRequest(request: Request) {
		return new CreateEntry(EntryPatch.from(request.body))
	}

	async run({ em, user }: OperationContext): Promise<Entry> {
		const patch = this.parameters
		if (!patch.sourceId) {
			throw new ValidationError('Missing sourceId', ['sourceId'])
		}
		const unclaimed = await fileStore.claim(user.id, patch.files ?? [])
		const to = await user.calendar(em, patch.sourceId)
		const incoming = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), type: to.source.defaultEntryType }).patch(patch).fit(to.integration.ownership)

		const errors = [...unclaimed, ...patch.validate({ to }), ...incoming.validate(to)]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		const relationsError = await assertRelationsValid(em, user, incoming, incoming.relations ?? EntryRelations.none)
		if (relationsError) {
			throw new ValidationError(relationsError, ['relations'])
		}

		const created = await to.integration.createEntry(em, incoming)
		await EntryRelation.reconcile(em, created.id!, created.relations ?? EntryRelations.none)
		await em.flush()
		await attachRelations(em, user, [created])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Created ${created.type} "${created.heading}" (${created.id}) in source ${to.source.id}`)
		return created
	}
}
