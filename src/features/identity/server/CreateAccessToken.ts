import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { AccessToken, AccessTokenScope } from '../AccessToken.js'

class Parameters {
	@validation(z.string().trim().min(1).max(60))
	@description('What the token is for, as the user will recognize it in the list (the agent or the machine).')
	readonly name!: string

	@validation(z.enum(AccessTokenScope))
	@description('Whether the agent may only read, or read and write.')
	readonly scope!: AccessTokenScope
}

@operation(Parameters)
@label('Create an access token')
@description('Makes an access token an agent connects with, answering the token itself this once beside its record.')
@http({ method: 'POST', path: '/user/access-tokens', status: 201 })
export class CreateAccessToken extends Operation<Parameters, { accessToken: AccessToken, token: string }> {
	async run({ em, user }: OperationContext) {
		const issued = await AccessToken.issue(user, this.parameters.name.trim(), this.parameters.scope)
		em.persist(issued.accessToken)
		await em.flush()
		this.logger.info(`Created ${this.parameters.scope} access token ${issued.accessToken.id} for user ${user.id}`)
		return issued
	}
}
