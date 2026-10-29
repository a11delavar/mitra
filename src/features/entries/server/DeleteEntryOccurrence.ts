import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { EntryOccurrence, EntryOccurrenceChangeScope } from '#features/recurrence'
import { tool } from '#features/agents/server/tool.js'
import { validation, ValidationError } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The repeating entry\'s id.')
	readonly id!: string

	@validation(z.date())
	@description('The occurrence\'s id: its original start, as the overview names it.')
	@converter(EntryOccurrence.idConverter)
	readonly occurrence!: Date

	@validation(z.enum(EntryOccurrenceChangeScope))
	@description('Which occurrences the deletion reaches: this one, this one and every later one, or all of them.')
	readonly scope!: EntryOccurrenceChangeScope
}

@operation(Parameters)
@label('Delete occurrences')
@description('Deletes one occurrence of a repeating entry, and with its scope the ones after it too, or all of them.')
@http({ method: 'DELETE', path: '/entries/:id/occurrences/:occurrence' })
@tool({ name: 'delete_entry_occurrence' })
@updates('entries')
export class DeleteEntryOccurrence extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const { scope } = this.parameters
		const entry = await user.getEntry(em, this.parameters.id)
		if (!entry.deletable) {
			throw new ValidationError('Entries in this calendar cannot be deleted from mitra')
		}
		const occurrence = entry.occurrences.existing(this.parameters.occurrence)
		if (scope === EntryOccurrenceChangeScope.All) {
			await entry.source.integration.deleteEntry(em, entry)
		} else {
			await occurrence.delete(scope).save(em, entry.source.integration)
		}
		await em.flush()
		this.logger.debug(`Deleted occurrence of series ${entry.id} (scope '${scope}')`)
	}
}
