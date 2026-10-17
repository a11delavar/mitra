import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { importer } from '../../../integrations/server/Importer.js'

@operation()
@label('Re-import a calendar')
@description('Discards a calendar\'s entries and reads them again from its provider, in the background.')
@http({ method: 'POST', path: '/sources/:id/reimport', status: 202 })
export class ReimportSource extends Operation<{ readonly id: string }, void> {
	async run({ em, user }: OperationContext): Promise<void> {
		const { source, integration } = await user.calendar(em, this.parameters.id)

		await integration.reimportSource(em, source)

		syncEmitter.emit('updated', user.id, 'sources')
		void importer.start(em, user.id, integration.id)
		this.logger.info(`Re-importing source "${source.name}" (${source.id})`)
	}
}
