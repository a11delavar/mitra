import { equals } from '@a11d/equals'
import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { EntryRelations } from '../../relations/EntryRelations.js'
import { assertRelationsValid, attachRelations } from '../../relations/server/relations.js'
import { fileStore } from '../../files/server/FileStore.js'
import { type EntryOccurrenceChangeScope } from '../../recurrence/EntryOccurrenceChange.js'
import { type Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'

/** Changing the list is the organizer's prerogative: iTIP (RFC 5546) limits everyone else to replying with their own status. */
class OrganizerOnly extends ValidationError {
	static override readonly status = 403
}

@operation()
@label('Change an entry')
@description('Changes an entry, or with a scope and an occurrence that occurrence, the ones from it on, or all of them. Fields left out keep their value; null clears one. A move to another calendar, or between event and task, gives the entry a new id.')
@http({ method: 'PUT', path: '/entries/:id' })
export class UpdateEntry extends Operation<{ readonly id: string, readonly patch: EntryPatch, readonly scope?: EntryOccurrenceChangeScope, readonly recurrenceId?: Date }, Entry> {
	static override fromRequest(request: Request) {
		const { id, scope, recurrenceId } = Operation.parametersOf(request) as { id: string, scope?: EntryOccurrenceChangeScope, recurrenceId?: Date }
		return new UpdateEntry({ id, scope, recurrenceId, patch: EntryPatch.from(request.body) })
	}

	async run({ em, user }: OperationContext): Promise<Entry> {
		const { id, patch, scope, recurrenceId } = this.parameters
		const existing = await user.entry(em, id)
		// The stored relations, up front: the provider's diff and the response BOTH need a definite value.
		await EntryRelation.loadFor(em, [existing])

		// Validated BEFORE any integration write, since a 400 must leave the external store untouched.
		const malformed = [...patch.validate(), ...await fileStore.claim(user.id, patch.files ?? [], existing.files)]
		if (malformed.length) {
			throw new AggregateError(malformed)
		}
		const { relations } = patch
		if (relations !== undefined) {
			const relationsError = await assertRelationsValid(em, user, existing, relations)
			if (relationsError) {
				throw new ValidationError(relationsError, ['relations'])
			}
		}

		const edit = existing.edit(patch)
		const incoming = edit.edited

		// Changing the list is the organizer's prerogative, so content edits pass only while they leave it as it is.
		if (!Object[equals](incoming.participants, existing.participants) && !existing.canManageParticipants) {
			throw new OrganizerOnly('Only the organizer can modify participants', ['participants'])
		}

		// The current calendar is owned transitively (the entry lookup above proved it); a DIFFERENT target proves its own ownership.
		const from = await user.calendar(em, existing.sourceId)
		const to = incoming.sourceId === existing.sourceId ? from : await user.calendar(em, incoming.sourceId)
		// Type conversion re-creates the entry below: tasks and events cannot share a CalDAV resource (RFC 4791 §4.1).
		const errors = [...patch.validate({ entry: existing, from, to, scope }), ...incoming.validate(to)]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		// The estimate is lost where the calendar has none: off the entry, and off the patch an occurrence's edit applies.
		incoming.fit(to.integration.ownership)
		if (!to.integration.ownership.holds('estimate')) {
			patch.estimate = null
		}

		if (scope && recurrenceId) {
			const change = existing.occurrences.at(recurrenceId).edit(patch, scope)
			const result = await change.save(em, from.integration, to.integration)
			if (scope === 'all' && result !== existing) {
				await EntryRelation.reconcile(em, result.id!, existing.relations ?? EntryRelations.none)
				result.relations = existing.relations
			}
			await em.flush()
			await attachRelations(em, user, [result])
			syncEmitter.emit('updated', user.id)
			this.logger.debug(`Edited occurrence of series ${existing.id} (scope '${scope}')`)
			return result
		}

		const recreated = edit.recreates
		const saved = await edit.save(em, from, to)
		if (recreated) {
			await EntryRelation.reconcile(em, saved.id!, saved.relations ?? EntryRelations.none)
		} else if (relations !== undefined) {
			await EntryRelation.reconcile(em, saved.id!, relations)
		}
		await em.flush()
		// Read back as any read answers it, so the browser keeps the entries it reaches until its next fetch.
		await attachRelations(em, user, [saved])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(recreated ? `Re-created entry ${existing.id} as ${saved.type} in source ${to.source.id} (new id ${saved.id})` : `Updated entry ${existing.id} "${saved.heading}"`)
		return saved
	}
}
