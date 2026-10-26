import { description, label } from '@a11d/metadata'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'
import { AccessToken } from '../AccessToken.js'

@operation()
@label('List access tokens')
@description('Lists the access tokens the user has given agents, the newest first.')
@http({ method: 'GET', path: '/user/access-tokens' })
export class ListAccessTokens extends Operation<object, Array<AccessToken>> {
	run({ em, user }: OperationContext) {
		return user.getAccessTokens(em)
	}
}
