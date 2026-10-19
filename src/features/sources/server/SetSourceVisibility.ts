import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '../../../infrastructure/validation/validation.js'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type Source } from '../Source.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string

	@validation(z.boolean())
	@description('Whether the calendar is hidden from the views.')
	readonly hidden!: boolean
}

@operation(Parameters)
@label('Show or hide a calendar')
@description('Shows or hides a calendar\'s entries. Hiding is a view preference: the calendar stays a place entries can go.')
@http({ method: 'PUT', path: '/sources/:id/visibility' })
export class SetSourceVisibility extends Operation<Parameters, Source> {
	async run({ em, user }: OperationContext) {
		const source = await user.source(em, this.parameters.id)

		source.hidden = this.parameters.hidden
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} ${source.hidden ? 'hidden' : 'shown'}`)
		return source
	}
}
