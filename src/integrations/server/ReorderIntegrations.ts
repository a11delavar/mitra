import { NotFoundError } from '@mikro-orm/sqlite'
import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../infrastructure/validation/ValidationError.js'
import { applyOrder } from '../../infrastructure/model/order.js'
import { http, operation, Operation, type OperationContext } from '../../infrastructure/operations/Operation.js'

@operation()
@label('Reorder integrations')
@description('Puts the user\'s integrations in the order of the ids given.')
@http({ method: 'PUT', path: '/integrations/order' })
export class ReorderIntegrations extends Operation<{ readonly ids?: unknown }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const ids = this.parameters.ids as Array<string>
		if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
			throw new ValidationError('A list of unique integration ids is required', ['ids'])
		}
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
