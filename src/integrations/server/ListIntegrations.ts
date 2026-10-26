import { description, label } from '@a11d/metadata'
import { Integration } from '#integrations'
import { http, operation, Operation, type OperationContext } from '#infrastructure/operations/Operation.js'

@operation()
@label('List integrations')
@description('Lists the accounts the user connected, each with its calendars.')
@http({ method: 'GET', path: '/integrations' })
export class ListIntegrations extends Operation<object, Array<Integration>> {
	run({ em, user }: OperationContext) {
		return user.getIntegrations(em)
	}
}
