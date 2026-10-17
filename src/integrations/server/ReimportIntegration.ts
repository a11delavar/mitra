import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../infrastructure/operations/Operation.js'
import { Source } from '../../features/sources/Source.js'
import { importer } from './Importer.js'

@operation()
@label('Re-import an integration')
@description('Discards the entries of an account\'s calendars that are turned on and reads them again, in the background.')
@http({ method: 'POST', path: '/integrations/:id/reimport', status: 202 })
export class ReimportIntegration extends Operation<{ readonly id: string }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const integration = await user.integration(em, this.parameters.id)
		const sources = await em.find(Source, { integrationId: integration.id, enabled: true })
		for (const source of sources) {
			await integration.reimportSource(em, source)
		}
		syncEmitter.emit('updated', user.id, 'sources')
		void importer.start(em, user.id, integration.id)
		this.logger.info(`Re-importing integration ${integration.id} (${sources.length} source(s))`)
	}
}
