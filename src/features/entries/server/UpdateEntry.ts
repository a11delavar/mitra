import { equals } from '@a11d/equals'
import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { fileStore } from '#features/files/server/FileStore.js'
import { OrganizerOnly } from '#features/participants/OrganizerOnly.js'
import { tool } from '#features/agents/server/tool.js'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'

class Parameters extends EntryPatch {
	@validation(z.string())
	@description('The entry\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Change an entry')
@description('Changes an entry itself: a one-off entry, or a repeating entry as a whole, its rule and what every occurrence shares. One occurrence is changed on its own, with how far the change reaches. Fields left out keep their value; null clears one. A move to another calendar, or between event and task, gives the entry a new id.')
@http({ method: 'PUT', path: '/entries/:id' })
@tool({ name: 'update_entry' })
export class UpdateEntry extends Operation<Parameters, Entry> {
	async run({ em, user }: OperationContext) {
		const patch = this.parameters
		const existing = await user.entry(em, patch.id)

		// Validated BEFORE any integration write, since a 400 must leave the external store untouched.
		const malformed = [...patch.validate(), ...await fileStore.claim(user.id, patch.files ?? [], existing.files)]
		if (malformed.length) {
			throw new AggregateError(malformed)
		}
		const { relations } = patch
		const edit = existing.edit(patch)
		const incoming = edit.edited

		// Changing the list is the organizer's prerogative, so content edits pass only while they leave it as it is.
		if (!Object[equals](incoming.participants, existing.participants) && !existing.canManageParticipants) {
			throw new OrganizerOnly('Only the organizer can modify participants', ['participants'])
		}

		// The current calendar is owned transitively (the entry lookup above proved it); a DIFFERENT target proves its own ownership.
		const from = await user.source(em, existing.sourceId)
		const to = incoming.sourceId === existing.sourceId ? from : await user.source(em, incoming.sourceId)
		// Type conversion re-creates the entry below: tasks and events cannot share a CalDAV resource (RFC 4791 §4.1).
		const errors = [...patch.validate({ entry: existing, from, to }), ...incoming.validate(to), ...(relations === undefined ? [] : relations.validate({ entry: existing, graph: await user.relationGraph(em, relations) }))]
		if (errors.length) {
			throw new AggregateError(errors)
		}
		incoming.fit(to.ownership)

		const recreated = edit.recreates(from, to)
		const saved = await edit.save(em, from, to)
		await em.flush()
		// Read back as any read answers it, so the browser keeps the entries it reaches until its next fetch.
		const graph = await user.relationGraph(em)
		graph.attach([saved])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(recreated ? `Re-created entry ${existing.id} as ${saved.type} in source ${to.id} (new id ${saved.id})` : `Updated entry ${existing.id} "${saved.heading}"`)
		return saved
	}
}
