import { description, label } from '@a11d/metadata'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../User.js'

@operation()
@label('Mark a version seen')
@description('Stores the version whose release notes the user has seen.')
@http({ method: 'PUT', path: '/user/seen-version' })
export class MarkVersionSeen extends Operation<{ readonly version?: unknown }, User> {
	async run({ em, user }: OperationContext): Promise<User> {
		const { version } = this.parameters
		if (typeof version !== 'string' || !version.trim() || version.length > 64) {
			throw new ValidationError('Invalid version', ['version'])
		}
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.lastSeenVersion = version
		await em.flush()
		user.lastSeenVersion = stored.lastSeenVersion
		return stored
	}
}
