import { description, label } from '@a11d/metadata'
import { converter } from '@a11d/converter'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Source } from '../Source.js'
import { Color } from '../Color.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string

	@validation(z.custom<Color>(value => value instanceof Color))
	@description('A color in hex (#3366cc) or by its CSS name.')
	@converter(Color.converter)
	readonly color!: Color
}

@operation(Parameters)
@label('Recolor a calendar')
@description('Gives a calendar another color, which Mitra keeps as its own.')
@http({ method: 'PUT', path: '/sources/:id/color' })
export class RecolorSource extends Operation<Parameters, Source> {
	async run({ em, user }: OperationContext) {
		const source = await user.getSource(em, this.parameters.id)

		source.color = this.parameters.color
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} recoloured to ${source.color}`)
		return source
	}
}
