import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { fileStore } from '#features/files/server/FileStore.js'
import { EntryOccurrence, EntryOccurrenceChangeScope } from '#features/recurrence'
import { tool } from '#features/agents/server/tool.js'
import { validation } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'

class Parameters extends EntryPatch {
	@validation(z.string())
	@description('The repeating entry\'s id.')
	readonly id!: string

	@validation(z.date())
	@description('The occurrence\'s id: its original start, as the overview names it.')
	@converter(EntryOccurrence.idConverter)
	readonly occurrence!: Date

	@validation(z.enum(EntryOccurrenceChangeScope))
	@description('Which occurrences the change reaches: this one, this one and every later one, or all of them.')
	readonly scope!: EntryOccurrenceChangeScope
}

@operation(Parameters)
@label('Change an occurrence')
@description('Changes one occurrence of a repeating entry, and with its scope the ones after it or all of them. Fields left out keep the occurrence\'s value; null clears one. Changed alone, the occurrence becomes an entry of its own, with an id of its own.')
@http({ method: 'PUT', path: '/entries/:id/occurrences/:occurrence' })
@tool({ name: 'update_entry_occurrence', annotations: { idempotentHint: false } })
@updates('entries')
export class UpdateEntryOccurrence extends Operation<Parameters, Entry> {
	async run({ em, user }: OperationContext) {
		const patch = this.parameters
		const { scope } = patch
		const existing = await user.getEntry(em, patch.id)
		// Judged as an edit of the repeating entry, whose occurrence the change below then writes.
		const change = existing.edit(patch)
		// The calendar it ends up in comes through the user, which proves it theirs.
		change.edited.source = await user.getSource(em, change.edited.sourceId)
		const reached = patch.relations && await user.getRelationGraph(em, change.related)
		const errors = [...await fileStore.claim(user.id, patch.files ?? [], existing.files), ...change.validate({ graph: reached, scope })]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		// The estimate is lost where the calendar has none, off the patch the occurrence's edit applies.
		if (!change.to.ownership.holds('estimate')) {
			patch.estimate = null
		}

		const result = await existing.occurrences.existing(patch.occurrence).edit(patch, scope).save(em, change.from.integration, change.to.integration)
		if (scope === EntryOccurrenceChangeScope.All && result !== existing) {
			result.relations = existing.relations
		}
		await em.flush()
		const graph = await user.getRelationGraph(em, [result.uid])
		graph.attach([result])
		this.logger.debug(`Edited occurrence of series ${existing.id} (scope '${scope}')`)
		return result
	}
}
