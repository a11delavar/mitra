import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '../../../infrastructure/validation/validation.js'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../User.js'

class Parameters {
	@validation(z.string().trim().min(1).max(64))
	@description('The version whose release notes the user has seen.')
	readonly version!: string
}

@operation(Parameters)
@label('Mark a version seen')
@description('Stores the version whose release notes the user has seen.')
@http({ method: 'PUT', path: '/user/seen-version' })
export class MarkVersionSeen extends Operation<Parameters, User> {
	async run({ em, user }: OperationContext) {
		const { version } = this.parameters
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.lastSeenVersion = version
		await em.flush()
		user.lastSeenVersion = stored.lastSeenVersion
		return stored as User
	}
}
