import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../infrastructure/operations/Operation.js'

@operation()
@label('Disconnect an integration')
@description('Disconnects an account and forgets its calendars and entries in Mitra, leaving them as they are at the provider.')
@http({ method: 'DELETE', path: '/integrations/:id' })
export class DisconnectIntegration extends Operation<{ readonly id: string }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const integration = await user.integration(em, this.parameters.id)
		// Its availability goes with it, so take back what was written for it first.
		await integration.publishAvailability(em, []).catch((error: unknown) =>
			this.logger.warn(`Could not take back the availability written to ${integration.toString()}: ${error instanceof Error ? error.message : error}`))
		em.remove(integration)
		await em.flush()
		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.info(`Disconnected integration ${integration.id}`)
	}
}
