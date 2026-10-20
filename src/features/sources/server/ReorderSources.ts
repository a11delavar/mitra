import { NotFoundError } from '@mikro-orm/sqlite'
import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation, ValidationError } from '#infrastructure/validation'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { applyOrder } from '#infrastructure/model'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { Source } from '../Source.js'

class Parameters {
	@validation(z.array(z.string()).min(1).refine(ids => new Set(ids).size === ids.length, 'A list of unique source ids is required'))
	@description('The calendars of one integration in their new order, by id.')
	readonly ids!: ReadonlyArray<string>
}

@operation(Parameters)
@label('Reorder calendars')
@description('Puts an integration\'s calendars in the order of the ids given.')
@http({ method: 'PUT', path: '/sources/order' })
export class ReorderSources extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const { ids } = this.parameters
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
