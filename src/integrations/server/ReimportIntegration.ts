import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
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
@updates('sources')
export class ReimportIntegration extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const integration = await user.getIntegration(em, this.parameters.id)
		const sources = integration.enabledSources
		for (const source of sources) {
			await integration.reimportSource(em, source)
		}
		void importer.start(em, user.id, integration.id)
		this.logger.info(`Re-importing integration ${integration.id} (${sources.length} source(s))`)
	}
}
