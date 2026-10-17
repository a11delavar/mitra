import { description, label } from '@a11d/metadata'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../../identity/User.js'

@operation()
@label('Show only one calendar')
@description('Hides every calendar but one, keeping the visibility from before so it can be restored.')
@http({ method: 'PUT', path: '/sources/:id/solo' })
export class ShowOnlySource extends Operation<{ readonly id: string }, User> {
	async run({ em, user }: OperationContext): Promise<User> {
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
