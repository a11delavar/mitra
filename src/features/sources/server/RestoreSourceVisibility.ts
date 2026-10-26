import { description, label } from '@a11d/metadata'
import { User } from '#features/identity'
import { syncEmitter } from '#infrastructure/realtime/syncEmitter.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

@operation()
@label('Restore calendar visibility')
@description('Shows and hides the calendars as they were before one was shown alone.')
@http({ method: 'PUT', path: '/sources/restore-visibility' })
export class RestoreSourceVisibility extends Operation<object, User> {
	async run({ em, user }: OperationContext): Promise<User> {
		if (!user.previouslyHiddenSourceIds) {
			return user
		}

		user.restorePreviousVisibility(await user.filterSources(em, { enabled: true }))
		await em.flush()

		syncEmitter.emit('updated', user.id, 'sources')
		this.logger.debug('Restored the visibility from before the solo')
		return user
	}
}
