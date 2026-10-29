import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The integration\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Disconnect an integration')
@description('Disconnects an account and forgets its calendars and entries in Mitra, leaving them as they are at the provider.')
@http({ method: 'DELETE', path: '/integrations/:id' })
@updates('sources')
export class DisconnectIntegration extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const integration = await user.getIntegration(em, this.parameters.id)
		// Its availability goes with it, so take back what was written for it first.
		await integration.publishAvailability(em, []).catch((error: unknown) =>
			this.logger.warn(`Could not take back the availability written to ${integration.toString()}: ${error instanceof Error ? error.message : error}`))
		em.remove(integration)
		await em.flush()
		this.logger.info(`Disconnected integration ${integration.id}`)
	}
}
