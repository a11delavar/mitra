import { description, label } from '@a11d/metadata'
import { fileStore } from '#features/files/server/FileStore.js'
import { tool } from '#features/agents/server/tool.js'
import { EntryTimeZone } from '#features/time/EntryTimeZone.js'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'

@operation(EntryPatch)
@label('Create an entry')
@description('Creates an event or a task in a calendar. A task without a start is unscheduled and waits in the planning list.')
@http({ method: 'POST', path: '/entries', status: 201 })
@tool({ name: 'create_entry' })
export class CreateEntry extends Operation<EntryPatch, Entry> {
	async run({ em, user }: OperationContext) {
		const patch = this.parameters
		const to = patch.sourceId ? await user.calendar(em, patch.sourceId) : await user.defaultCalendar(em, patch.type)
		patch.sourceId = to.source.id
		// Times written without a zone were read in the home zone, so the entry keeps it.
		if (patch.timeZone === undefined && !patch.allDay && user.timeZones?.home) {
			patch.timeZone = EntryTimeZone.parse(user.timeZones.home.zone.id)
		}
		const unclaimed = await fileStore.claim(user.id, patch.files ?? [])
		const incoming = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), type: to.source.defaultEntryType }).patch(patch).fit(to.integration.ownership)

		const { relations } = incoming
		const errors = [...unclaimed, ...patch.validate({ to }), ...incoming.validate(to), ...(relations === undefined ? [] : relations.validate({ entry: incoming, graph: await user.relationGraph(em, relations) }))]
		if (errors.length) {
			throw new AggregateError(errors)
		}

		const created = await to.integration.createEntry(em, incoming)
		await em.flush()
		const graph = await user.relationGraph(em)
		graph.attach([created])
		syncEmitter.emit('updated', user.id)
		this.logger.debug(`Created ${created.type} "${created.heading}" (${created.id}) in source ${to.source.id}`)
		return created
	}
}
