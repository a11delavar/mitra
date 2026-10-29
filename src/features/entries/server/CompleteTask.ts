import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { EntryOccurrence, EntryOccurrenceChangeScope } from '#features/recurrence'
import { tool } from '#features/agents/server/tool.js'
import { validation, ValidationError } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'

class Parameters {
	@validation(z.string())
	@description('The task\'s id.')
	readonly id!: string

	@validation(z.date().optional())
	@description('The occurrence\'s id, which a repeating task needs: its original start, as the overview names it.')
	@converter(EntryOccurrence.idConverter)
	readonly occurrence?: Date
}

@operation(Parameters)
@label('Complete a task')
@description('Marks a task done. A repeating task is done one occurrence at a time: that occurrence leaves the repeating entry as an entry of its own, done, with a new id, which this answers; change it from then on with update_entry. The rest are still to come.')
@http({ method: 'POST', path: '/entries/:id/complete' })
@tool({ name: 'complete_task', annotations: { idempotentHint: true } })
@updates('entries')
export class CompleteTask extends Operation<Parameters, Entry> {
	async run({ em, user }: OperationContext) {
		const { id, occurrence } = this.parameters
		const existing = await user.getEntry(em, id)
		if (!existing.type.isTask) {
			throw new ValidationError('Only a task can be completed')
		}

		const completed = existing.clone()
		completed.done = true
		const change = existing.edit(EntryPatch.of(completed, ['status', 'percentComplete']))
		// An occurrence detaches like a 'this' edit.
		const scope = existing.recurrence?.freq ? EntryOccurrenceChangeScope.This : undefined
		const errors = [
			...scope && !occurrence ? [new ValidationError('This task repeats: name the occurrence to complete', ['occurrence'])] : [],
			...change.validate({ scope }),
		]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		if (scope && occurrence) {
			const detached = await existing.occurrences.existing(occurrence).edit(change.patch, EntryOccurrenceChangeScope.This).save(em, change.from.integration)
			await em.flush()
			this.logger.debug(`Completed occurrence ${occurrence.toISOString()} of series ${existing.id} "${existing.heading}"`)
			return detached
		}

		// A second tap must not write to the provider again.
		if (change.edited.status === existing.status && change.edited.percentComplete === existing.percentComplete) {
			return existing
		}

		await change.save(em)
		await em.flush()
		this.logger.debug(`Completed task ${existing.id} "${existing.heading}"`)
		return existing
	}
}
