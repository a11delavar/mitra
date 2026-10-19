import { equals } from '@a11d/equals'
import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { validation } from '../../../infrastructure/validation/validation.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { EntryRelations } from '../../relations/EntryRelations.js'
import { assertRelationsValid, attachRelations } from '../../relations/server/relations.js'
import { fileStore } from '../../files/server/FileStore.js'
import { OrganizerOnly } from '../../participants/OrganizerOnly.js'
import { EntryOccurrence } from '../../recurrence/EntryOccurrence.js'
import { EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'
import { tool } from '../../agents/server/tool.js'
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
export class UpdateEntryOccurrence extends Operation<Parameters, Entry> {
	async run({ em, user }: OperationContext) {
		const patch = this.parameters
		const { scope } = patch
		const existing = await user.entry(em, patch.id)
		// The stored relations, up front: the provider's diff and the response BOTH need a definite value.
		await EntryRelation.loadFor(em, [existing])

		// Validated BEFORE any integration write, since a 400 must leave the external store untouched.
		const malformed = [...patch.validate(), ...await fileStore.claim(user.id, patch.files ?? [], existing.files)]
		if (malformed.length) {
			throw new AggregateError(malformed)
		}
		if (patch.relations !== undefined) {
			const relationsError = await assertRelationsValid(em, user, existing, patch.relations)
			if (relationsError) {
				throw new ValidationError(relationsError, ['relations'])
			}
		}

		const incoming = existing.edit(patch).edited

		// Changing the list is the organizer's prerogative, so content edits pass only while they leave it as it is.
		if (!Object[equals](incoming.participants, existing.participants) && !existing.canManageParticipants) {
			throw new OrganizerOnly('Only the organizer can modify participants', ['participants'])
		}

		// The current calendar is owned transitively (the entry lookup above proved it); a DIFFERENT target proves its own ownership.
		const from = await user.calendar(em, existing.sourceId)
		const to = incoming.sourceId === existing.sourceId ? from : await user.calendar(em, incoming.sourceId)
		const errors = [...patch.validate({ entry: existing, from, to, scope }), ...incoming.validate(to)]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		// The estimate is lost where the calendar has none, off the patch the occurrence's edit applies.
		if (!to.integration.ownership.holds('estimate')) {
			patch.estimate = null
		}

		const change = existing.occurrences.existing(patch.occurrence).edit(patch, scope)
		const result = await change.save(em, from.integration, to.integration)
		if (scope === EntryOccurrenceChangeScope.All && result !== existing) {
			await EntryRelation.reconcile(em, result.id!, existing.relations ?? EntryRelations.none)
			result.relations = existing.relations
		}
		await em.flush()
		await attachRelations(em, user, [result])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Edited occurrence of series ${existing.id} (scope '${scope}')`)
		return result
	}
}
