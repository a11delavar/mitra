import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Source } from '../Source.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string

	@validation(z.boolean())
	@description('Whether the Routines tab leaves out the routines of this calendar.')
	readonly disabled!: boolean
}

@operation(Parameters)
@label('Show or hide a calendar\'s routines')
@description('Shows or hides in the Routines tab what a calendar keeps doing; its routines stay, hidden.')
@http({ method: 'PUT', path: '/sources/:id/routines' })
@updates('sources')
export class SetSourceRoutines extends Operation<Parameters, Source> {
	async run({ em, user }: OperationContext) {
		const source = await user.getSource(em, this.parameters.id)
		source.routinesDisabled = this.parameters.disabled
		await em.flush()
		return source
	}
}
