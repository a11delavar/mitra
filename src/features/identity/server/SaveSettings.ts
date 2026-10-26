import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { User } from '../User.js'

class Parameters {
	@validation(z.record(z.string(), z.unknown()))
	@description('The account\'s settings, by key.')
	readonly settings!: Readonly<Record<string, unknown>>
}

@operation(Parameters)
@label('Save settings')
@description('Stores the account\'s settings, keeping only what deviates from the defaults.')
@http({ method: 'PUT', path: '/user/settings' })
export class SaveSettings extends Operation<Parameters, User> {
	async run({ em, user }: OperationContext) {
		user.applySettings(this.parameters.settings)
		await em.flush()
		return user
	}
}
