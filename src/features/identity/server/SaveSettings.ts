import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '../../../infrastructure/operations/Operation.js'
import { User } from '../User.js'

@operation()
@label('Save settings')
@description('Stores the account\'s settings, keeping only what deviates from the defaults.')
@http({ method: 'PUT', path: '/user/settings' })
export class SaveSettings extends Operation<{ readonly settings?: unknown }, User> {
	async run({ em, user }: OperationContext): Promise<User> {
		const stored = await em.findOneOrFail(User, { id: user.id })
		stored.applySettings(this.parameters.settings)
		await em.flush()
		user.settings = stored.settings
		return stored
	}
}
