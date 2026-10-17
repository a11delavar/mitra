import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'
import { TaskStatus } from '../TaskStatus.js'

@operation()
@label('Complete a task')
@description('Marks a task done. An occurrence of a repeating task is done on its own, the rest still to come.')
@http({ method: 'POST', path: '/entries/:id/complete' })
/** The occurrence comes as its start in epoch milliseconds, as the notification's facts carry it. */
export class CompleteTask extends Operation<{ readonly id: string, readonly recurrenceId?: number }, Entry> {
	async run({ em, user }: OperationContext): Promise<Entry> {
		const { id, recurrenceId } = this.parameters
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
		if (typeof recurrenceId === 'number' && existing.recurrence?.freq) {
			const start = new Date(recurrenceId)
			const change = existing.occurrences.at(start).edit(EntryPatch.of(done, ['status', 'percentComplete']), 'this')
			const detached = await change.save(em, integration)
			await em.flush()
			syncEmitter.emit('updated', user.id)
			this.logger.debug(`Completed occurrence ${start.toISOString()} of series ${existing.id} "${existing.heading}"`)
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
