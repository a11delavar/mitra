import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { Source } from '#features/sources'
import { validation } from '#infrastructure/validation'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { importer } from './Importer.js'

class Parameters {
	@validation(z.string())
	@description('The integration\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Re-import an integration')
@description('Discards the entries of an account\'s calendars that are turned on and reads them again, in the background.')
@http({ method: 'POST', path: '/integrations/:id/reimport', status: 202 })
export class ReimportIntegration extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
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
