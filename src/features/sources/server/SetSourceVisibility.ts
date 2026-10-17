import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type Source } from '../Source.js'

@operation()
@label('Show or hide a calendar')
@description('Shows or hides a calendar\'s entries. Hiding is a view preference: the calendar stays a place entries can go.')
@http({ method: 'PUT', path: '/sources/:id/visibility' })
export class SetSourceVisibility extends Operation<{ readonly id: string, readonly hidden?: boolean }, Source> {
	async run({ em, user }: OperationContext): Promise<Source> {
		const { id, hidden } = this.parameters
		const source = await user.source(em, id)

		source.hidden = hidden as boolean
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} ${source.hidden ? 'hidden' : 'shown'}`)
		return source
	}
}
