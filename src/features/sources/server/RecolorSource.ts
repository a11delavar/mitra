import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { type Source } from '../Source.js'

@operation()
@label('Recolor a calendar')
@description('Gives a calendar another color, which Mitra keeps as its own.')
@http({ method: 'PUT', path: '/sources/:id/color' })
export class RecolorSource extends Operation<{ readonly id: string, readonly color?: string }, Source> {
	async run({ em, user }: OperationContext): Promise<Source> {
		const { id, color } = this.parameters
		const source = await user.source(em, id)

		source.color = color as string
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} recoloured to ${source.color}`)
		return source
	}
}
