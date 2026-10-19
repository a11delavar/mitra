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

	@validation(z.string().min(1))
	@description('A CSS color.')
	readonly color!: string
}

@operation(Parameters)
@label('Recolor a calendar')
@description('Gives a calendar another color, which Mitra keeps as its own.')
@http({ method: 'PUT', path: '/sources/:id/color' })
export class RecolorSource extends Operation<Parameters, Source> {
	async run({ em, user }: OperationContext) {
		const source = await user.source(em, this.parameters.id)

		source.color = this.parameters.color
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} recoloured to ${source.color}`)
		return source
	}
}
