import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { validation } from '../../../infrastructure/validation/validation.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'
import { tool } from '../../agents/server/tool.js'
import { type Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'
import { TaskStatus } from '../TaskStatus.js'

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
export class CompleteTask extends Operation<Parameters, Entry> {
	async run({ em, user }: OperationContext) {
		const { id, occurrence } = this.parameters
		const existing = await user.entry(em, id)
		const { source, integration } = await user.calendar(em, existing.sourceId)
		const capabilities = integration.capabilitiesFor(source)

		if (!existing.type?.isTask) {
			throw new ValidationError('Only a task can be completed')
		}
		if (!capabilities.entries.edit) {
			throw new ValidationError('This calendar cannot be edited from mitra')
		}

		const done = existing.clone()
		done.setStatus(TaskStatus.Done, integration.ownership)

		// An occurrence detaches like a 'this' edit.
		if (existing.recurrence?.freq) {
			if (!occurrence) {
				throw new ValidationError('This task repeats: name the occurrence to complete', ['occurrence'])
			}
			const change = existing.occurrences.existing(occurrence).edit(EntryPatch.of(done, ['status', 'percentComplete']), EntryOccurrenceChangeScope.This)
			const detached = await change.save(em, integration)
			await em.flush()
			syncEmitter.emit('updated', user.id)
			this.logger.debug(`Completed occurrence ${occurrence.toISOString()} of series ${existing.id} "${existing.heading}"`)
			return detached
		}

		// A second tap must not write to the provider again.
		if (done.status === existing.status && done.percentComplete === existing.percentComplete) {
			return existing
		}

		await integration.updateEntry(em, existing, done)
		await em.flush()
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Completed task ${existing.id} "${existing.heading}"`)
		return existing
	}
}
