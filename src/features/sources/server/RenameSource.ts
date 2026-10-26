import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { type Source } from '../Source.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string

	@validation(z.string().trim().min(1, 'A name is required'))
	@description('The calendar\'s name.')
	readonly name!: string
}

@operation(Parameters)
@label('Rename a calendar')
@description('Gives a calendar a name of the user\'s own, which survives the provider\'s syncs until the provider renames it.')
@http({ method: 'PUT', path: '/sources/:id/name' })
export class RenameSource extends Operation<Parameters, Source> {
	async run({ em, user }: OperationContext) {
		const source = await user.getSource(em, this.parameters.id)

		source.name = this.parameters.name
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} renamed to "${source.name}"`)
		return source
	}
}
