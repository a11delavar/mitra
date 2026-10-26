import { description, label } from '@a11d/metadata'
import { Integration } from '#integrations'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { importer } from './Importer.js'

@operation()
@label('Change an integration')
@description('Changes an account\'s credentials and which of its calendars are turned on, importing those turned on in the background.')
@http({ method: 'PUT', path: '/integrations/:id', body: 'integration' })
export class UpdateIntegration extends Operation<{ readonly id: string, readonly integration: Integration }, Integration> {
	async run({ em, user }: OperationContext): Promise<Integration> {
		const integration = await user.getIntegration(em, this.parameters.id)
		await integration.apply(em, this.parameters.integration)
		syncEmitter.emit('updated', user.id, 'sources')
		// A calendar turned off takes back the busy availability written to it; one turned on gets it once its import completes.
		await integration.publishAvailability(em).then(() => em.flush()).catch((error: unknown) =>
			this.logger.warn(`Could not bring the availability written to ${integration.toString()} in line: ${error instanceof Error ? error.message : error}`))
		this.logger.debug(`Updated integration ${integration.id}`)
		// A fresh context, so its calendars are loaded as they now stand.
		const saved = await em.fork().findOneOrFail(Integration, { id: integration.id })
		void importer.start(em, user.id, integration.id)
		return saved
	}
}
