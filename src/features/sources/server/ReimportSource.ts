import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { importer } from '#integrations/server/Importer.js'
import { validation } from '#infrastructure/validation'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Re-import a calendar')
@description('Discards a calendar\'s entries and reads them again from its provider, in the background.')
@http({ method: 'POST', path: '/sources/:id/reimport', status: 202 })
export class ReimportSource extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const source = await user.source(em, this.parameters.id)

		await source.integration.reimportSource(em, source)

		syncEmitter.emit('updated', user.id, 'sources')
		void importer.start(em, user.id, source.integrationId)
		this.logger.info(`Re-importing source "${source.name}" (${source.id})`)
	}
}
