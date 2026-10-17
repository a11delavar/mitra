import { description, label } from '@a11d/metadata'
import { type Request } from 'express'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { isDemo, isDeveloperSystem } from '../../infrastructure/environment.js'
import { NotAllowed } from '../../infrastructure/validation/NotAllowed.js'
import { http, operation, Operation, type OperationContext } from '../../infrastructure/operations/Operation.js'
import { Integration, integrationClassFor } from '../Integration.js'
import { importer } from './Importer.js'

@operation()
@label('Connect an integration')
@description('Connects an account with the calendars chosen, and imports their entries in the background.')
@http({ method: 'POST', path: '/integrations', status: 201 })
export class ConnectIntegration extends Operation<{ readonly integration: Integration }, Integration> {
	static override fromRequest(request: Request) {
		return new ConnectIntegration({ integration: request.body as Integration })
	}

	async run({ em, user }: OperationContext): Promise<Integration> {
		if (isDemo) {
			throw new NotAllowed('Connecting accounts is turned off in the demo')
		}
		const incoming = this.parameters.integration
		if (integrationClassFor(incoming.type).developmentOnly && !isDeveloperSystem) {
			throw new NotAllowed('This integration is only available on a development system')
		}
		const integration: Integration = new (integrationClassFor(incoming.type))({ userId: user.id })
		em.persist(integration)
		await integration.apply(em, incoming)
		syncEmitter.emit('updated', user.id, 'sources')
		// A fresh context, so its calendars are loaded as they now stand.
		const saved = await em.fork().findOneOrFail(Integration, { id: integration.id })
		const enabled = saved.sources.filter(source => source.enabled).length
		this.logger.info(`Connected ${integration.type} integration with ${enabled} source(s) enabled`)
		void importer.start(em, user.id, integration.id)
		return saved
	}
}
