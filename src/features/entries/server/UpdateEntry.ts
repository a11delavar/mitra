import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { fileStore } from '#features/files/server/FileStore.js'
import { tool } from '#features/agents/server/tool.js'
import { validation } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
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
@updates('entries')
export class UpdateEntry extends Operation<Parameters, Entry> {
	async run({ em, user }: OperationContext) {
		const patch = this.parameters
		const existing = await user.getEntry(em, patch.id)
		const change = existing.edit(patch)
		// The calendar it ends up in comes through the user, which proves it theirs.
		change.edited.source = await user.getSource(em, change.edited.sourceId)
		const reached = patch.relations && await user.getRelationGraph(em, change.related)
		const errors = [...await fileStore.claim(user.id, patch.files ?? [], existing.files), ...change.validate({ graph: reached })]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		const { recreates } = change
		const saved = await change.save(em)
		await em.flush()
		// Read back as any read answers it, so the browser keeps the entries it reaches until its next fetch.
		const graph = await user.getRelationGraph(em, [saved.uid])
		graph.attach([saved])
		this.logger.debug(recreates ? `Re-created entry ${existing.id} as ${saved.type} in source ${saved.sourceId} (new id ${saved.id})` : `Updated entry ${existing.id} "${saved.heading}"`)
		return saved
	}
}
