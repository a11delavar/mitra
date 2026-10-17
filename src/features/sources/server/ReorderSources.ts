import { NotFoundError } from '@mikro-orm/sqlite'
import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { applyOrder } from '../../../infrastructure/model/order.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { Source } from '../Source.js'

@operation()
@label('Reorder calendars')
@description('Puts an integration\'s calendars in the order of the ids given.')
@http({ method: 'PUT', path: '/sources/order' })
export class ReorderSources extends Operation<{ readonly ids?: unknown }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const ids = this.parameters.ids as Array<string>
		if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
			throw new ValidationError('A list of unique source ids is required', ['ids'])
		}
		const sources = await user.sources(em, { id: { $in: ids } })
		if (sources.length !== ids.length) {
			throw new NotFoundError('Unknown source')
		}
		if (new Set(sources.map(source => source.integrationId)).size > 1) {
			throw new ValidationError('Sources can only be reordered within their integration', ['ids'])
		}
		applyOrder(await em.find(Source, { integrationId: sources[0]!.integrationId }), ids)
		await em.flush()
		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Reordered ${ids.length} source(s)`)
	}
}
