import { description, label } from '@a11d/metadata'
import { z } from 'zod'
import { validation } from '#infrastructure/validation'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

class Parameters {
	@validation(z.string())
	@description('The access token\'s id.')
	readonly id!: string
}

@operation(Parameters)
@label('Revoke an access token')
@description('Revokes an access token, so the agent using it can no longer connect; one already gone is not refused.')
@http({ method: 'DELETE', path: '/user/access-tokens/:id' })
export class RevokeAccessToken extends Operation<Parameters, void> {
	async run({ em, user }: OperationContext) {
		const [accessToken] = await user.filterAccessTokens(em, { id: this.parameters.id })
		if (accessToken) {
			em.remove(accessToken)
			await em.flush()
			this.logger.info(`Revoked access token ${accessToken.id} of user ${user.id}`)
		}
	}
}
