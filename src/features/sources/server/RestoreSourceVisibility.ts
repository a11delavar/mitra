import { description, label } from '@a11d/metadata'
import { User } from '#features/identity'
import { updates } from '#infrastructure/realtime/Updates.js'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

@operation()
@label('Restore calendar visibility')
@description('Shows and hides the calendars as they were before one was shown alone.')
@http({ method: 'PUT', path: '/sources/restore-visibility' })
@updates('sources')
export class RestoreSourceVisibility extends Operation<object, User> {
	async run({ em, user }: OperationContext): Promise<User> {
		if (!user.previouslyHiddenSourceIds) {
			return user
		}

		user.restorePreviousVisibility(await user.filterSources(em, { enabled: true }))
		await em.flush()

		this.logger.debug('Restored the visibility from before the solo')
		return user
	}
}
