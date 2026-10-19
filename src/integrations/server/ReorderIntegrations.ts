import { NotFoundError } from '@mikro-orm/sqlite'
import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '../../infrastructure/validation/validation.js'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { applyOrder } from '../../infrastructure/model/order.js'
import { http, operation, Operation, type OperationContext } from '../../infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.array(z.string()).min(1).refine(ids => new Set(ids).size === ids.length, 'A list of unique integration ids is required'))
	@description('The integrations in their new order, by id.')
	readonly ids!: ReadonlyArray<string>
}

@operation(Parameters)
@label('Reorder integrations')
@description('Puts the user\'s integrations in the order of the ids given.')
@http({ method: 'PUT', path: '/integrations/order' })
export class ReorderIntegrations extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const { ids } = this.parameters
		const integrations = await user.integrations(em)
		const owned = new Set(integrations.map(integration => integration.id))
		if (ids.some(id => !owned.has(id))) {
			throw new NotFoundError('Unknown integration')
		}
		applyOrder(integrations, ids)
		await em.flush()
		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Reordered ${ids.length} integration(s)`)
	}
}
