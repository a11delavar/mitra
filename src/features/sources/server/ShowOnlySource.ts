import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { User } from '#features/identity'
import { validation, ValidationError } from '#infrastructure/validation'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The calendar\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Show only one calendar')
@description('Hides every calendar but one, keeping the visibility from before so it can be restored.')
@http({ method: 'PUT', path: '/sources/:id/solo' })
export class ShowOnlySource extends Operation<Parameters, User> {
	async run({ em, user }: OperationContext) {
		const source = await user.source(em, this.parameters.id)
		if (!source.enabled) {
			throw new ValidationError('A disabled source cannot be the only one shown')
		}
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.showOnly(await user.sources(em, { enabled: true }), source.id)
		await em.flush()

		user.previouslyHiddenSourceIds = stored.previouslyHiddenSourceIds
		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug(`Source ${source.id} is now the only one shown`)
		return stored
	}
}
